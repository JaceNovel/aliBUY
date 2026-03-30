import { buildApiUrl } from "@/lib/api";
import { reenrichImportedProduct } from "@/lib/alibaba-operations-service";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;

    try {
      const upstreamUrl = buildApiUrl(`/api/admin/aliexpress/import/${encodeURIComponent(String(id))}/reenrich`);
      const currentUrl = new URL(request.url);
      const upstreamHost = new URL(upstreamUrl).host;

      if (upstreamHost && upstreamHost !== currentUrl.host) {
        const upstreamResponse = await fetch(upstreamUrl, {
          method: "POST",
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

    const product = await reenrichImportedProduct(String(id));
    return Response.json({ product });
  } catch (error) {
    return Response.json({
      message: error instanceof Error ? error.message : "Réenrichissement impossible.",
    }, { status: 400 });
  }
}
