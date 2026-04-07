import { maybeProxyAliExpressAdminRequest } from "@/app/api/admin/aliexpress/proxy";
import { reenrichImportedProduct } from "@/lib/alibaba-operations-service";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;

    const proxiedResponse = await maybeProxyAliExpressAdminRequest({
      request,
      path: `/api/admin/aliexpress/import/${encodeURIComponent(String(id))}/reenrich`,
      method: "POST",
    });

    if (proxiedResponse) {
      return proxiedResponse;
    }

    const product = await reenrichImportedProduct(String(id));
    return Response.json({ product });
  } catch (error) {
    return Response.json({
      message: error instanceof Error ? error.message : "Réenrichissement impossible.",
    }, { status: 400 });
  }
}
