import { maybeProxyAliExpressAdminRequest } from "@/app/api/admin/aliexpress/proxy";
import { getAlibabaPurchaseOrders } from "@/lib/alibaba-operations-store";
import { createAlibabaPurchaseOrder } from "@/lib/alibaba-operations-service";

export async function GET(request: Request) {
  const proxiedResponse = await maybeProxyAliExpressAdminRequest({
    request,
    path: "/api/admin/aliexpress/purchase-orders",
    method: "GET",
  });

  if (proxiedResponse) {
    return proxiedResponse;
  }

  const orders = await getAlibabaPurchaseOrders();
  return Response.json({ orders });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const proxiedResponse = await maybeProxyAliExpressAdminRequest({
      request,
      path: "/api/admin/aliexpress/purchase-orders",
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    if (proxiedResponse) {
      return proxiedResponse;
    }

    const order = await createAlibabaPurchaseOrder({
      importedProductId: String(body?.importedProductId ?? ""),
      sourceProductId: body?.sourceProductId ? String(body.sourceProductId) : undefined,
      quantity: Number(body?.quantity ?? 1),
      shippingAddressId: body?.shippingAddressId ? String(body.shippingAddressId) : undefined,
    });

    return Response.json({ order });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Creation du lot d'achat impossible.";
    return Response.json({ message }, { status: 400 });
  }
}
