import { NextResponse } from "next/server";

import { API_URL, buildApiUrl } from "@/lib/api";
import { getManyChatAccountProfile } from "@/lib/account-manychat";
import { getBackendAccessTokenFromCookies } from "@/lib/backend-access-token";
import { persistHostedCheckoutPaymentToOrder } from "@/lib/hosted-checkout-sourcing";
import { verifyMonerooPayment as verifyLocalMonerooPayment } from "@/lib/moneroo";
import { getPayPalCurrencyCode, getPayPalProcessedAt, normalizePayPalPaymentStatus, verifyPayPalPayment } from "@/lib/paypal";
import { buildServerForwardHeaders } from "@/lib/server-forward-headers";
import { getSourcingOrderById } from "@/lib/sourcing-store";
import { getSourcingOrderMeta, withSourcingOrderMeta } from "@/lib/alibaba-sourcing";
import { getCurrentUser } from "@/lib/user-auth";

class PaymentRouteError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "PaymentRouteError";
    this.status = status;
  }
}

async function requireUser() {
  return getCurrentUser().catch(() => null);
}

async function verifyBackendProxyPayPalPayment(paymentId: string) {
  if (!API_URL || !process.env.ADMIN_API_TOKEN?.trim()) {
    return null;
  }

  const response = await fetch(buildApiUrl("/api/payments/paypal/proxy/verify"), {
    method: "POST",
    headers: await buildServerForwardHeaders({
      accept: "application/json",
      "content-type": "application/json",
    }, {
      includeAdminApiToken: true,
    }),
    body: JSON.stringify({ paymentId }),
    cache: "no-store",
  });

  const body = await response.json().catch(() => null) as {
    message?: string;
    paymentId?: string;
    checkoutUrl?: string;
    paymentStatus?: string;
    payment?: unknown;
  } | null;

  if (response.status === 401 || response.status === 403) {
    return null;
  }

  if (!response.ok || !body?.paymentId) {
    throw new PaymentRouteError(body?.message || "Impossible de verifier le paiement PayPal.", response.status || 502);
  }

  return body;
}

function toErrorResponse(error: unknown, fallbackMessage: string) {
  const status = error instanceof PaymentRouteError
    ? error.status
    : error instanceof Error && /configur|required|introuvable|associe|indisponible/i.test(error.message)
      ? 422
      : 502;
  const message = error instanceof Error && error.message.trim() ? error.message : fallbackMessage;

  return NextResponse.json({ message }, { status });
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
  const provider = payload && typeof payload === "object" && "provider" in payload && String(payload.provider).trim() === "paypal"
    ? "paypal"
    : "moneroo";
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
  const shouldUseLocalFallback = user.authProvider === "clerk" || !API_URL || !backendAccessToken;

  if (!shouldUseLocalFallback) {
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
    if (response.status !== 401 && response.status !== 403) {
      return NextResponse.json(body ?? { message: "Impossible de verifier le paiement." }, { status: response.status || 502 });
    }
  }

  {
    try {
      const orderId = payload && typeof payload === "object" && "orderId" in payload ? String(payload.orderId) : "";
      const order = orderId ? await getSourcingOrderById(orderId) : null;
      if (!order || (order.userId !== user.id && order.customerEmail.trim().toLowerCase() !== user.email.trim().toLowerCase())) {
        return NextResponse.json({ message: "Commande introuvable." }, { status: 404 });
      }

      const paymentId = payload && typeof payload === "object" && "paymentId" in payload
        ? String(payload.paymentId)
        : order.monerooPaymentId;
      if (!paymentId) {
        return NextResponse.json({ message: provider === "paypal" ? "Aucun paiement PayPal n'est associe a cette commande." : "Aucun paiement Moneroo n'est associe a cette commande." }, { status: 422 });
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

      if (provider === "paypal") {
        const proxiedPayment = await verifyBackendProxyPayPalPayment(paymentId);
        const payment = proxiedPayment?.payment && typeof proxiedPayment.payment === "object"
          ? proxiedPayment.payment as Parameters<typeof getPayPalCurrencyCode>[0]
          : await verifyPayPalPayment(paymentId);
        const checkoutUrl = proxiedPayment?.checkoutUrl || payment.links?.find((link) => link.rel === "approve")?.href;
        const nextOrder = await persistHostedCheckoutPaymentToOrder({
          order: orderWithManyChat,
          verified: true,
          payment: {
            provider,
            id: proxiedPayment?.paymentId || payment.id,
            status: proxiedPayment?.paymentStatus || payment.status,
            normalizedStatus: normalizePayPalPaymentStatus(proxiedPayment?.paymentStatus || payment.status),
            checkoutUrl,
            currency: getPayPalCurrencyCode(payment),
            payload: payment,
            processedAt: getPayPalProcessedAt(payment),
          },
        });

        return NextResponse.json({
          order: nextOrder,
          paymentId: proxiedPayment?.paymentId || payment.id,
          checkoutUrl,
          paymentStatus: nextOrder.paymentStatus,
        });
      }

      const payment = await verifyLocalMonerooPayment(paymentId);
      const nextOrder = await persistHostedCheckoutPaymentToOrder({
        order: orderWithManyChat,
        verified: true,
        payment: {
          provider,
          id: payment.id,
          status: payment.status,
          normalizedStatus: payment.status && ["initiated", "initialized"].includes(payment.status.toLowerCase()) ? "initialized" : payment.status && ["pending", "processing", "in_progress", "in progress"].includes(payment.status.toLowerCase()) ? "pending" : payment.status && ["success", "successful", "succeeded", "completed", "complete", "paid", "processed"].includes(payment.status.toLowerCase()) ? "paid" : payment.status && ["failed", "error", "expired", "declined"].includes(payment.status.toLowerCase()) ? "failed" : payment.status && ["cancelled", "canceled"].includes(payment.status.toLowerCase()) ? "cancelled" : "unpaid",
          checkoutUrl: payment.checkout_url,
          currency: payment.currency && typeof payment.currency === "string" ? payment.currency : typeof payment.currency === "object" && payment.currency ? payment.currency.code : undefined,
          payload: payment,
          initiatedAt: payment.initiated_at,
          processedAt: payment.processed_at,
        },
      });

      return NextResponse.json({
        order: nextOrder,
        paymentId: payment.id,
        checkoutUrl: payment.checkout_url || nextOrder.monerooCheckoutUrl,
        paymentStatus: nextOrder.paymentStatus,
      });
    } catch (error) {
      return toErrorResponse(error, provider === "paypal" ? "Impossible de verifier le paiement PayPal." : "Impossible de verifier le paiement.");
    }
  }
}
