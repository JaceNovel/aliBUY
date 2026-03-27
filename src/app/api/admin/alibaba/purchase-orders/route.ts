import { getAlibabaPurchaseOrders } from "@/lib/alibaba-operations-store";
import { createAlibabaPurchaseOrder } from "@/lib/alibaba-operations-service";

export async function GET() {
  const orders = await getAlibabaPurchaseOrders();
  return Response.json({ orders });
}

export async function POST(request: Request) {
  const body = await request.json();
  const order = await createAlibabaPurchaseOrder({
    importedProductId: String(body?.importedProductId ?? ""),
    quantity: Number(body?.quantity ?? 1),
    shippingAddressId: body?.shippingAddressId ? String(body.shippingAddressId) : undefined,
  });

  return Response.json({ order });
}
