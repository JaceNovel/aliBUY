import { maybeProxyAliExpressAdminRequest } from "@/app/api/admin/aliexpress/proxy";
import { reenrichAllImportedProducts } from "@/lib/alibaba-operations-service";

export async function POST(request: Request) {
  try {
    const proxiedResponse = await maybeProxyAliExpressAdminRequest({
      request,
      path: "/api/admin/aliexpress/import/reenrich",
      method: "POST",
    });

    if (proxiedResponse) {
      return proxiedResponse;
    }

    const result = await reenrichAllImportedProducts();
    return Response.json(result);
  } catch (error) {
    return Response.json({
      message: error instanceof Error ? error.message : "Réenrichissement global impossible.",
    }, { status: 400 });
  }
}