import { initializeMonerooPayment } from "@/lib/moneroo";
import { persistMonerooPaymentToOrder } from "@/lib/moneroo-sourcing";
import { getSourcingOrderById } from "@/lib/sourcing-store";

function splitCustomerName(fullName: string) {
  const trimmed = fullName.trim();
  if (!trimmed) {
    return { firstName: "Client", lastName: "AfriPay" };
  }

  const [firstName, ...rest] = trimmed.split(/\s+/);
  return {
    firstName,
    lastName: rest.join(" ") || "AfriPay",
  };
}

function getRequestedMethods() {
  const configuredMethods = process.env.MONEROO_PAYMENT_METHODS?.split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return configuredMethods && configuredMethods.length > 0 ? configuredMethods : undefined;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const orderId = typeof body?.orderId === "string" ? body.orderId : "";
    const order = await getSourcingOrderById(orderId);

    if (!order) {
      return Response.json({ message: "Commande sourcing introuvable." }, { status: 404 });
    }

    if (order.paymentStatus === "paid") {
      return Response.json({ message: "Cette commande est deja payee.", order }, { status: 409 });
    }

    if ((order.paymentStatus === "initialized" || order.paymentStatus === "pending") && order.monerooCheckoutUrl) {
      return Response.json({
        order,
        paymentId: order.monerooPaymentId,
        checkoutUrl: order.monerooCheckoutUrl,
        paymentStatus: order.monerooPaymentStatus,
      });
    }

    const origin = new URL(request.url).origin;
    const customerName = splitCustomerName(order.customerName);
    const payment = await initializeMonerooPayment({
      amount: order.totalPriceFcfa,
      currency: order.paymentCurrency || "XOF",
      description: `Paiement commande sourcing ${order.orderNumber}`,
      return_url: `${origin}/orders/payment?orderId=${encodeURIComponent(order.id)}`,
      customer: {
        email: order.customerEmail,
        first_name: customerName.firstName,
        last_name: customerName.lastName,
        phone: order.customerPhone || undefined,
        address: [order.addressLine1, order.addressLine2].filter(Boolean).join(", ") || undefined,
        city: order.city || undefined,
        state: order.state || undefined,
        country: order.countryCode || undefined,
        zip: order.postalCode || undefined,
      },
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerEmail: order.customerEmail,
      },
      methods: getRequestedMethods(),
    });

    const nextOrder = await persistMonerooPaymentToOrder({
      order,
      payment,
    });

    return Response.json({
      order: nextOrder,
      paymentId: payment.id,
      checkoutUrl: payment.checkout_url,
      paymentStatus: payment.status,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Impossible d'initialiser le paiement Moneroo.";
    return Response.json({ message }, { status: 500 });
  }
}