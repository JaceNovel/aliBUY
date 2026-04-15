import { NextResponse } from "next/server";

import { API_URL, buildApiUrl } from "@/lib/api";
import { getManyChatAccountProfile } from "@/lib/account-manychat";
import { getBackendAccessTokenFromCookies } from "@/lib/backend-access-token";
import { verifyMonerooPayment as verifyLocalMonerooPayment } from "@/lib/moneroo";
import { persistMonerooPaymentToOrder } from "@/lib/moneroo-sourcing";
import { buildServerForwardHeaders } from "@/lib/server-forward-headers";
import { getSourcingOrderById } from "@/lib/sourcing-store";
import { getSourcingOrderMeta, withSourcingOrderMeta } from "@/lib/alibaba-sourcing";
import { getCurrentUser } from "@/lib/user-auth";

async function requireUser() {
  return getCurrentUser().catch(() => null);
}

function emptyManyChatAccountProfile() {
  return {
    phone: undefined,
    connectedWhatsapp: undefined,
    manychatSubscriberId: undefined,
    manychatFlowId: undefined,
    manychatPaidTagId: undefined,
  };
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const user = await requireUser();
  if (!user) {
    if (!API_URL) {
      return NextResponse.json({ message: "Verification de paiement indisponible sans backend Laravel." }, { status: 503 });
    }

    const response = await fetch(buildApiUrl("/api/free-deals/verify-payment"), {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify(payload ?? {}),
      cache: "no-store",
    });

    const body = await response.json().catch(() => null);
    return NextResponse.json(body ?? { message: "Impossible de verifier le paiement." }, { status: response.status || 502 });
  }

  const backendAccessToken = await getBackendAccessTokenFromCookies();
  if (user.authProvider === "clerk" || !API_URL || !backendAccessToken) {
    const orderId = payload && typeof payload === "object" && "orderId" in payload ? String(payload.orderId) : "";
    const order = orderId ? await getSourcingOrderById(orderId) : null;
    if (!order || (order.userId !== user.id && order.customerEmail.trim().toLowerCase() !== user.email.trim().toLowerCase())) {
      return NextResponse.json({ message: "Commande introuvable." }, { status: 404 });
    }

    const paymentId = payload && typeof payload === "object" && "paymentId" in payload
      ? String(payload.paymentId)
      : order.monerooPaymentId;
    if (!paymentId) {
      return NextResponse.json({ message: "Aucun paiement Moneroo n'est associe a cette commande." }, { status: 422 });
    }

    const accountManyChat = await getManyChatAccountProfile(user).catch(() => emptyManyChatAccountProfile());
    const currentManyChat = getSourcingOrderMeta(order).manychat;
    const orderWithManyChat = !currentManyChat?.subscriberId && accountManyChat.manychatSubscriberId
      ? withSourcingOrderMeta(order, {
          manychat: {
            subscriberId: accountManyChat.manychatSubscriberId,
            flowId: accountManyChat.manychatFlowId,
            paidTagId: accountManyChat.manychatPaidTagId,
          },
        })
      : order;

    const payment = await verifyLocalMonerooPayment(paymentId);
    const nextOrder = await persistMonerooPaymentToOrder({ order: orderWithManyChat, payment, verified: true });

    return NextResponse.json({
      order: nextOrder,
      paymentId: payment.id,
      checkoutUrl: payment.checkout_url || nextOrder.monerooCheckoutUrl,
      paymentStatus: nextOrder.paymentStatus,
    });
  }

  const response = await fetch(buildApiUrl("/api/payments/verify"), {
    method: "POST",
    headers: await buildServerForwardHeaders({
      accept: "application/json",
      "content-type": "application/json",
    }),
    body: JSON.stringify(payload ?? {}),
    cache: "no-store",
  });

  const body = await response.json().catch(() => null);
  return NextResponse.json(body ?? { message: "Impossible de verifier le paiement." }, { status: response.status || 502 });
}
