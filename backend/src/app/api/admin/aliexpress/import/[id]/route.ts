import { buildApiUrl } from "@/lib/api";
import { deleteImportedProduct } from "@/lib/alibaba-operations-service";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const sourceProductId = new URL(request.url).searchParams.get("sourceProductId") ?? undefined;

    try {
      const upstreamUrl = buildApiUrl(`/api/admin/aliexpress/import/${encodeURIComponent(String(id))}`, sourceProductId ? { sourceProductId } : undefined);
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

    const result = await deleteImportedProduct(String(id), sourceProductId);
    return Response.json(result);
  } catch (error) {
    return Response.json({
      message: error instanceof Error ? error.message : "Suppression de l'article importe impossible.",
    }, { status: 400 });
  }
}
