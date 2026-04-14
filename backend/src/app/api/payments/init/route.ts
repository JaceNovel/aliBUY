import { NextResponse } from "next/server";

import { API_URL, buildApiUrl } from "@/lib/api";
import { getBackendAccessTokenFromCookies } from "@/lib/backend-access-token";
import { initializeMonerooPayment as initializeLocalMonerooPayment } from "@/lib/moneroo";
import { persistMonerooPaymentToOrder } from "@/lib/moneroo-sourcing";
import { buildServerForwardHeaders } from "@/lib/server-forward-headers";
import { SITE_URL } from "@/lib/site-config";
import { getSourcingOrderById } from "@/lib/sourcing-store";
import { getCurrentUser } from "@/lib/user-auth";

async function requireUser() {
  return getCurrentUser().catch(() => null);
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ message: "Connexion requise." }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const backendAccessToken = await getBackendAccessTokenFromCookies();
  if (user.authProvider === "clerk" || !API_URL || !backendAccessToken) {
    const orderId = payload && typeof payload === "object" && "orderId" in payload ? String(payload.orderId) : "";
    const order = orderId ? await getSourcingOrderById(orderId) : null;
    if (!order || (order.userId !== user.id && order.customerEmail.trim().toLowerCase() !== user.email.trim().toLowerCase())) {
      return NextResponse.json({ message: "Commande introuvable." }, { status: 404 });
    }

    if ((order.paymentStatus === "initialized" || order.paymentStatus === "pending") && order.monerooCheckoutUrl) {
      return NextResponse.json({
        order,
        paymentId: order.monerooPaymentId,
        checkoutUrl: order.monerooCheckoutUrl,
        paymentStatus: order.paymentStatus,
      });
    }

    const [firstName, ...lastNameParts] = order.customerName.trim().split(/\s+/);
    const payment = await initializeLocalMonerooPayment({
      amount: order.totalPriceFcfa,
      currency: order.paymentCurrency || "XOF",
      description: `Paiement commande sourcing ${order.orderNumber}`,
      return_url: `${SITE_URL.replace(/\/$/, "")}/orders?orderId=${encodeURIComponent(order.id)}`,
      customer: {
        email: order.customerEmail,
        first_name: firstName || order.customerName || "Client",
        last_name: lastNameParts.join(" ") || "AfriPay",
        phone: order.customerPhone,
        address: order.addressLine1,
        city: order.city,
        state: order.state,
        country: order.countryCode,
        zip: order.postalCode,
      },
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerEmail: order.customerEmail,
      },
    });
    const nextOrder = await persistMonerooPaymentToOrder({ order, payment });

    return NextResponse.json({
      order: nextOrder,
      paymentId: payment.id,
      checkoutUrl: payment.checkout_url || nextOrder.monerooCheckoutUrl,
      paymentStatus: nextOrder.paymentStatus,
    });
  }

  const response = await fetch(buildApiUrl("/api/payments/init"), {
    method: "POST",
    headers: await buildServerForwardHeaders({
      accept: "application/json",
      "content-type": "application/json",
    }),
    body: JSON.stringify(payload ?? {}),
    cache: "no-store",
  });

  const body = await response.json().catch(() => null);
  return NextResponse.json(body ?? { message: "Impossible d'initialiser le paiement." }, { status: response.status || 502 });
}
