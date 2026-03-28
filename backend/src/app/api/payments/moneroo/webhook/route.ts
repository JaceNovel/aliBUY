import { getMonerooPayment, verifyMonerooPayment, verifyMonerooWebhookSignature, type MonerooPaymentRecord } from "@/lib/moneroo";
import { persistMonerooPaymentToOrder, resolveSourcingOrderForMoneroo } from "@/lib/moneroo-sourcing";
import { syncSourcingOrderForDeferredSupplierPayment } from "@/lib/sourcing-batch-service";

type MonerooWebhookPayload = {
  event?: string;
  data?: MonerooPaymentRecord & {
    metadata?: Record<string, string>;
  };
};

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("X-Moneroo-Signature");

    if (!verifyMonerooWebhookSignature(rawBody, signature)) {
      return new Response("Invalid signature", { status: 403 });
    }

    const payload = JSON.parse(rawBody) as MonerooWebhookPayload;
    const paymentId = payload.data?.id;
    if (!paymentId) {
      return Response.json({ received: true });
    }

    const order = await resolveSourcingOrderForMoneroo({
      paymentId,
      metadata: payload.data?.metadata || null,
    });

    if (!order) {
      return Response.json({ received: true, ignored: true });
    }

    const payment = payload.event === "payment.success"
      ? await verifyMonerooPayment(paymentId)
      : await getMonerooPayment(paymentId);

    const nextOrder = await persistMonerooPaymentToOrder({
      order,
      payment,
      verified: payload.event === "payment.success",
    });
    await syncSourcingOrderForDeferredSupplierPayment(nextOrder, "moneroo-webhook");

    return Response.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur webhook Moneroo.";
    return Response.json({ message }, { status: 500 });
  }
}