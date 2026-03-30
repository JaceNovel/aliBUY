import { API_URL, buildApiUrl } from "@/lib/api";
import { deleteAllImportedProducts, runAlibabaCatalogImport } from "@/lib/alibaba-operations-service";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    try {
      if (!API_URL) {
        throw new Error("Local admin AliExpress execution.");
      }

      const upstreamUrl = buildApiUrl("/api/admin/aliexpress/import");
      const currentUrl = new URL(request.url);
      const upstreamHost = new URL(upstreamUrl).host;

      if (upstreamHost && upstreamHost !== currentUrl.host) {
        const upstreamResponse = await fetch(upstreamUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
          cache: "no-store",
        });

        const payload = await upstreamResponse.json().catch(() => null);
        return Response.json(payload, { status: upstreamResponse.status });
      }
    } catch {
      // Fall back to the local store when the upstream backend is unreachable.
    }

    const result = await runAlibabaCatalogImport({
      query: String(body?.query ?? ""),
      limit: Number(body?.limit ?? 12),
      fulfillmentChannel: body?.fulfillmentChannel ?? "crossborder",
      autoPublish: Boolean(body?.autoPublish),
      resetImportedProducts: Boolean(body?.resetImportedProducts),
    });

    return Response.json(result);
  } catch (error) {
    return Response.json({
      message: error instanceof Error ? error.message : "Import AliExpress impossible.",
    }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    try {
      if (!API_URL) {
        throw new Error("Local admin AliExpress execution.");
      }

      const upstreamUrl = buildApiUrl("/api/admin/aliexpress/import");
      const currentUrl = new URL(request.url);
      const upstreamHost = new URL(upstreamUrl).host;

      if (upstreamHost && upstreamHost !== currentUrl.host) {
        const upstreamResponse = await fetch(upstreamUrl, {
          method: "DELETE",
          headers: request.headers.get("cookie")
            ? { cookie: request.headers.get("cookie") ?? "" }
            : undefined,
          cache: "no-store",
        });

        const payload = await upstreamResponse.json().catch(() => null);
        return Response.json(payload, { status: upstreamResponse.status });
      }
    } catch {
      // Fall back to the local store when the upstream backend is unreachable.
    }

    const result = await deleteAllImportedProducts();
    return Response.json(result);
  } catch (error) {
    return Response.json({
      message: error instanceof Error ? error.message : "Purge des articles importes impossible.",
    }, { status: 400 });
  }
}
