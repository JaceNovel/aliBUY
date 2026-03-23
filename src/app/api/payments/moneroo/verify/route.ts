import { verifyMonerooPayment } from "@/lib/moneroo";
import { persistMonerooPaymentToOrder } from "@/lib/moneroo-sourcing";
import { getSourcingOrderById } from "@/lib/sourcing-store";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const orderId = typeof body?.orderId === "string" ? body.orderId : "";
    const requestedPaymentId = typeof body?.paymentId === "string" ? body.paymentId : "";
    const order = await getSourcingOrderById(orderId);

    if (!order) {
      return Response.json({ message: "Commande sourcing introuvable." }, { status: 404 });
    }

    const paymentId = requestedPaymentId || order.monerooPaymentId;
    if (!paymentId) {
      return Response.json({ message: "Aucun paiement Moneroo a verifier pour cette commande." }, { status: 400 });
    }

    const payment = await verifyMonerooPayment(paymentId);
    const nextOrder = await persistMonerooPaymentToOrder({
      order,
      payment,
      verified: true,
    });

    return Response.json({
      order: nextOrder,
      payment,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Impossible de verifier le paiement Moneroo.";
    return Response.json({ message }, { status: 500 });
  }
}