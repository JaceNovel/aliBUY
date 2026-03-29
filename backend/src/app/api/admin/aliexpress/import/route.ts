import { buildApiUrl } from "@/lib/api";
import { runAlibabaCatalogImport } from "@/lib/alibaba-operations-service";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    try {
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
    });

    return Response.json(result);
  } catch (error) {
    return Response.json({
      message: error instanceof Error ? error.message : "Import AliExpress impossible.",
    }, { status: 400 });
  }
}
