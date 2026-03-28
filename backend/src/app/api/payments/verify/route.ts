import { verifyMonerooPayment } from "@/lib/moneroo";
import { persistMonerooPaymentToOrder } from "@/lib/moneroo-sourcing";
import { syncSourcingOrderForDeferredSupplierPayment } from "@/lib/sourcing-batch-service";
import { getSourcingOrderById } from "@/lib/sourcing-store";
import { getCurrentUser } from "@/lib/user-auth";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ message: "Connexion requise." }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const orderId = typeof body?.orderId === "string" ? body.orderId : "";
    const requestedPaymentId = typeof body?.paymentId === "string" ? body.paymentId : "";
    const order = await getSourcingOrderById(orderId);

    if (!order) {
      return Response.json({ message: "Commande sourcing introuvable." }, { status: 404 });
    }

    if (!(order.userId === user.id || order.customerEmail.toLowerCase() === user.email.toLowerCase())) {
      return Response.json({ message: "Acces refuse." }, { status: 403 });
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
    const queuedOrder = await syncSourcingOrderForDeferredSupplierPayment(nextOrder, "moneroo-verify");

    return Response.json({
      order: queuedOrder,
      payment,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Impossible de verifier le paiement Moneroo.";
    return Response.json({ message }, { status: 500 });
  }
}