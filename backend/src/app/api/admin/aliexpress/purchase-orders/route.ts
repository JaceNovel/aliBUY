import { getAlibabaPurchaseOrders } from "@/lib/alibaba-operations-store";
import { createAlibabaPurchaseOrder } from "@/lib/alibaba-operations-service";

export async function GET() {
  const orders = await getAlibabaPurchaseOrders();
  return Response.json({ orders });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const order = await createAlibabaPurchaseOrder({
      importedProductId: String(body?.importedProductId ?? ""),
      quantity: Number(body?.quantity ?? 1),
      shippingAddressId: body?.shippingAddressId ? String(body.shippingAddressId) : undefined,
    });

    return Response.json({ order });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Creation du lot d'achat impossible.";
    return Response.json({ message }, { status: 400 });
  }
}
