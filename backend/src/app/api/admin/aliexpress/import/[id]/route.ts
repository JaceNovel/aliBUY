import { maybeProxyAliExpressAdminRequest } from "@/app/api/admin/aliexpress/proxy";
import { deleteImportedProduct } from "@/lib/alibaba-operations-service";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const sourceProductId = new URL(request.url).searchParams.get("sourceProductId") ?? undefined;

    const proxiedResponse = await maybeProxyAliExpressAdminRequest({
      request,
      path: `/api/admin/aliexpress/import/${encodeURIComponent(String(id))}`,
      method: "DELETE",
      query: sourceProductId ? { sourceProductId } : undefined,
      fallbackOnResponse: (upstreamResponse) => upstreamResponse.status === 403 || upstreamResponse.status === 404 || upstreamResponse.status >= 500,
      onFallbackResponse: (upstreamResponse, { upstreamUrl }) => {
        console.warn("[admin/aliexpress/import/:id] upstream unavailable, fallback to local handler", {
          upstreamUrl,
          status: upstreamResponse.status,
        });
      },
    });

    if (proxiedResponse) {
      return proxiedResponse;
    }

    const result = await deleteImportedProduct(String(id), sourceProductId);
    return Response.json(result);
  } catch (error) {
    return Response.json({
      message: error instanceof Error ? error.message : "Suppression de l'article importe impossible.",
    }, { status: 400 });
  }
}
