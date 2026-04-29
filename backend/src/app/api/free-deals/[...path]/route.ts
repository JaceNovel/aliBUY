import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";

import { FREE_DEAL_DEVICE_COOKIE } from "@/lib/free-deal-constants";
import { createFreeDealOrder, isFreeDealOrder, resolveRequestIp } from "@/lib/free-deal-service";
import { getFreeDealAccessState, getFreeDealConfig, getFreeDealProducts, getPurchasedFreeDealProductSlugs } from "@/lib/free-deal-store";
import { persistHostedCheckoutPaymentToOrder } from "@/lib/hosted-checkout-sourcing";
import { initializeMonerooPayment, normalizeMonerooPaymentStatus, verifyMonerooPayment } from "@/lib/moneroo";
import { extractPayPalCheckoutUrl, getPayPalCurrencyCode, getPayPalProcessedAt, initializePayPalPayment, normalizePayPalPaymentStatus, verifyPayPalPayment } from "@/lib/paypal";
import { SITE_URL } from "@/lib/site-config";
import { getSourcingOrderById } from "@/lib/sourcing-store";
import { getCurrentUser } from "@/lib/user-auth";

type RouteContext = {
  params: Promise<{
    path?: string[];
  }>;
};

class FreeDealRouteError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "FreeDealRouteError";
    this.status = status;
  }
}

function toErrorResponse(error: unknown, fallbackMessage: string) {
  const status = error instanceof FreeDealRouteError
    ? error.status
    : error instanceof Error && /choisir|indisponible|introuvable|associe|obligatoire|invalide/i.test(error.message)
      ? 422
      : 502;
  const message = error instanceof Error && error.message.trim() ? error.message : fallbackMessage;

  return NextResponse.json({ message }, { status });
}

function getRouteKey(path: string[] | undefined) {
  return path?.join("/") || "";
}

function normalizeProvider(value: unknown) {
  return String(value).trim().toLowerCase() === "paypal" ? "paypal" : "moneroo";
}

function normalizeCustomerString(value: unknown, fieldLabel: string, required = true) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (required && !normalized) {
    throw new FreeDealRouteError(`${fieldLabel} est obligatoire.`, 422);
  }

  return normalized;
}

async function getOptionalUser() {
  return getCurrentUser().catch(() => null);
}

async function handleState() {
  const [config, products, claimedProductSlugs, user, cookieStore, headerStore] = await Promise.all([
    getFreeDealConfig(),
    getFreeDealProducts(),
    getPurchasedFreeDealProductSlugs(),
    getOptionalUser(),
    cookies(),
    headers(),
  ]);

  const access = await getFreeDealAccessState({
    deviceId: cookieStore.get(FREE_DEAL_DEVICE_COOKIE)?.value,
    ip: resolveRequestIp(headerStore),
    userAgent: headerStore.get("user-agent"),
    userId: user?.id,
    customerEmail: user?.email,
  }, config);

  return NextResponse.json({
    config,
    products,
    claimedProductSlugs,
    access: {
      status: access.status,
      referralVisitCount: access.referralVisitCount,
      referralGoal: access.referralGoal,
      sharePath: access.sharePath,
      referralCode: access.claim?.referralCode,
    },
  });
}

async function handleCheckout(request: Request) {
  const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!payload) {
    throw new FreeDealRouteError("Payload invalide.", 400);
  }

  const selectedSlugs = Array.isArray(payload.selectedSlugs)
    ? payload.selectedSlugs.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];
  if (selectedSlugs.length === 0) {
    throw new FreeDealRouteError("Vous devez choisir au moins un article.", 422);
  }

  const [config, user, cookieStore, headerStore] = await Promise.all([
    getFreeDealConfig(),
    getOptionalUser(),
    cookies(),
    headers(),
  ]);
  const provider = normalizeProvider(payload.provider);
  const order = await createFreeDealOrder({
    config,
    selectedSlugs,
    customer: {
      customerName: normalizeCustomerString(payload.customerName, "Le nom client"),
      customerEmail: normalizeCustomerString(payload.customerEmail, "L'email client"),
      customerPhone: normalizeCustomerString(payload.customerPhone, "Le telephone client"),
      addressLine1: normalizeCustomerString(payload.addressLine1, "L'adresse"),
      addressLine2: normalizeCustomerString(payload.addressLine2, "Le complement d'adresse", false),
      city: normalizeCustomerString(payload.city, "La ville"),
      state: normalizeCustomerString(payload.state, "La region", false),
      postalCode: normalizeCustomerString(payload.postalCode, "Le code postal", false),
      countryCode: normalizeCustomerString(payload.countryCode, "Le code pays"),
    },
    visitor: {
      deviceId: cookieStore.get(FREE_DEAL_DEVICE_COOKIE)?.value,
      ip: resolveRequestIp(headerStore),
      userAgent: headerStore.get("user-agent"),
      userId: user?.id,
      customerEmail: typeof payload.customerEmail === "string" ? payload.customerEmail : undefined,
    },
    user,
  });

  const siteUrl = SITE_URL.replace(/\/$/, "");
  const returnUrl = `${siteUrl}/articles-gratuits/paiement?orderId=${encodeURIComponent(order.id)}&provider=${provider}`;
  const cancelUrl = `${siteUrl}/articles-gratuits`;
  const [firstName, ...lastNameParts] = order.customerName.trim().split(/\s+/);

  if (provider === "paypal") {
    const payment = await initializePayPalPayment({
      amount: config.fixedPriceEur,
      currency: "EUR",
      description: `Paiement lot articles gratuits ${order.orderNumber}`,
      return_url: returnUrl,
      cancel_url: cancelUrl,
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerEmail: order.customerEmail,
      },
    });
    const checkoutUrl = extractPayPalCheckoutUrl(payment);
    const nextOrder = await persistHostedCheckoutPaymentToOrder({
      order,
      payment: {
        provider,
        id: payment.id,
        status: payment.status,
        normalizedStatus: normalizePayPalPaymentStatus(payment.status),
        checkoutUrl,
        currency: getPayPalCurrencyCode(payment),
        payload: payment,
      },
    });

    return NextResponse.json({
      orderId: nextOrder.id,
      checkoutUrl,
      paymentId: payment.id,
      paymentStatus: nextOrder.paymentStatus,
    });
  }

  const payment = await initializeMonerooPayment({
    amount: order.totalPriceFcfa,
    currency: "XOF",
    description: `Paiement lot articles gratuits ${order.orderNumber}`,
    return_url: returnUrl,
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
  const nextOrder = await persistHostedCheckoutPaymentToOrder({
    order,
    payment: {
      provider,
      id: payment.id,
      status: payment.status,
      normalizedStatus: normalizeMonerooPaymentStatus(payment.status),
      checkoutUrl: payment.checkout_url,
      currency: typeof payment.currency === "string" ? payment.currency : payment.currency?.code,
      payload: payment,
      initiatedAt: payment.initiated_at,
      processedAt: payment.processed_at,
    },
  });

  return NextResponse.json({
    orderId: nextOrder.id,
    checkoutUrl: payment.checkout_url || nextOrder.monerooCheckoutUrl,
    paymentId: payment.id,
    paymentStatus: nextOrder.paymentStatus,
  });
}

async function handleVerifyPayment(request: Request) {
  const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!payload) {
    throw new FreeDealRouteError("Payload invalide.", 400);
  }

  const orderId = normalizeCustomerString(payload.orderId, "La commande");
  const order = await getSourcingOrderById(orderId);
  if (!order || !isFreeDealOrder(order)) {
    throw new FreeDealRouteError("Commande articles gratuits introuvable.", 404);
  }

  const provider = normalizeProvider(payload.provider || order.paymentProvider);
  const paymentId = typeof payload.paymentId === "string" && payload.paymentId.trim()
    ? payload.paymentId.trim()
    : order.monerooPaymentId;
  if (!paymentId) {
    throw new FreeDealRouteError(provider === "paypal" ? "Aucun paiement PayPal n'est associe a cette commande." : "Aucun paiement Moneroo n'est associe a cette commande.", 422);
  }

  if (provider === "paypal") {
    const payment = await verifyPayPalPayment(paymentId);
    const checkoutUrl = extractPayPalCheckoutUrl(payment);
    const nextOrder = await persistHostedCheckoutPaymentToOrder({
      order,
      verified: true,
      payment: {
        provider,
        id: payment.id,
        status: payment.status,
        normalizedStatus: normalizePayPalPaymentStatus(payment.status),
        checkoutUrl,
        currency: getPayPalCurrencyCode(payment),
        payload: payment,
        processedAt: getPayPalProcessedAt(payment),
      },
    });

    return NextResponse.json({
      order: nextOrder,
      paymentId: payment.id,
      checkoutUrl,
      paymentStatus: nextOrder.paymentStatus,
    });
  }

  const payment = await verifyMonerooPayment(paymentId);
  const nextOrder = await persistHostedCheckoutPaymentToOrder({
    order,
    verified: true,
    payment: {
      provider,
      id: payment.id,
      status: payment.status,
      normalizedStatus: normalizeMonerooPaymentStatus(payment.status),
      checkoutUrl: payment.checkout_url,
      currency: typeof payment.currency === "string" ? payment.currency : payment.currency?.code,
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
}

export async function GET(request: Request, context: RouteContext) {
  const params = await context.params;
  const routeKey = getRouteKey(params.path);

  if (routeKey === "state") {
    try {
      return await handleState();
    } catch (error) {
      return toErrorResponse(error, "Impossible de charger l'etat des articles gratuits.");
    }
  }

  return NextResponse.json({ message: "Route articles gratuits introuvable." }, { status: 404 });
}

export async function POST(request: Request, context: RouteContext) {
  const params = await context.params;
  const routeKey = getRouteKey(params.path);

  if (routeKey === "checkout") {
    try {
      return await handleCheckout(request);
    } catch (error) {
      return toErrorResponse(error, "Impossible de preparer cette offre.");
    }
  }

  if (routeKey === "verify-payment") {
    try {
      return await handleVerifyPayment(request);
    } catch (error) {
      return toErrorResponse(error, "Impossible de verifier le paiement.");
    }
  }

  return NextResponse.json({ message: "Route articles gratuits introuvable." }, { status: 404 });
}