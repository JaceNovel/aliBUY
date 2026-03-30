import { cookies, headers } from "next/headers";

import { API_URL, buildApiUrl } from "@/lib/api";
import { FREE_DEAL_DEVICE_COOKIE } from "@/lib/free-deal-constants";
import { createFreeDealOrder, resolveRequestIp, resolveRequestOrigin, type FreeDealCheckoutCustomerInput } from "@/lib/free-deal-service";
import { getFreeDealAccessState, getFreeDealConfig } from "@/lib/free-deal-store";
import { initializeMonerooPayment } from "@/lib/moneroo";
import { persistMonerooPaymentToOrder } from "@/lib/moneroo-sourcing";
import { SITE_URL } from "@/lib/site-config";
import { getCurrentUser } from "@/lib/user-auth";

export const runtime = "nodejs";

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

function normalizeCustomerInput(body: Record<string, unknown>): FreeDealCheckoutCustomerInput {
  return {
    customerName: String(body.customerName ?? "").trim(),
    customerEmail: String(body.customerEmail ?? "").trim().toLowerCase(),
    customerPhone: String(body.customerPhone ?? "").trim(),
    addressLine1: String(body.addressLine1 ?? "").trim(),
    addressLine2: String(body.addressLine2 ?? "").trim(),
    city: String(body.city ?? "").trim(),
    state: String(body.state ?? "").trim(),
    postalCode: String(body.postalCode ?? "").trim(),
    countryCode: String(body.countryCode ?? "").trim().toUpperCase(),
  };
}

function isValidCheckoutCustomer(customer: FreeDealCheckoutCustomerInput) {
  return Boolean(
    customer.customerName
    && customer.customerEmail
    && customer.customerPhone
    && customer.addressLine1
    && customer.city
    && customer.countryCode,
  );
}

function buildProxyHeaders(request: Request) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };

  for (const headerName of ["cookie", "user-agent", "x-forwarded-for", "x-real-ip", "x-forwarded-proto", "x-forwarded-host"]) {
    const value = request.headers.get(headerName);
    if (value) {
      headers[headerName] = value;
    }
  }

  return headers;
}

async function maybeProxy(request: Request, rawBody: string) {
  if (!API_URL) {
    return null;
  }

  const upstreamUrl = buildApiUrl("/api/free-deals/checkout");
  const currentUrl = new URL(request.url);
  const upstreamHost = new URL(upstreamUrl).host;

  if (!upstreamHost || upstreamHost === currentUrl.host) {
    return null;
  }

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      method: "POST",
      headers: buildProxyHeaders(request),
      body: rawBody || "{}",
      cache: "no-store",
    });
    const rawPayload = await upstreamResponse.text();
    let payload: unknown = null;

    if (rawPayload) {
      try {
        payload = JSON.parse(rawPayload) as unknown;
      } catch {
        payload = null;
      }
    }

    if (payload && typeof payload === "object") {
      return Response.json(payload, { status: upstreamResponse.status });
    }

    return Response.json({
      message: rawPayload.trim() || `Payment API request failed with status ${upstreamResponse.status}.`,
    }, { status: upstreamResponse.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payment API upstream request failed.";
    return Response.json({ message }, { status: 502 });
  }

  return null;
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const proxied = await maybeProxy(request, rawBody);
    if (proxied) {
      return proxied;
    }

    const body = (rawBody ? JSON.parse(rawBody) : {}) as Record<string, unknown>;
    const selectedSlugs = Array.isArray(body.selectedSlugs)
      ? body.selectedSlugs.map((entry) => String(entry).trim()).filter(Boolean)
      : [];
    const customer = normalizeCustomerInput(body);

    if (!isValidCheckoutCustomer(customer)) {
      return Response.json({ message: "Renseignez les informations client et l'adresse avant de continuer." }, { status: 400 });
    }

    const [cookieStore, headerStore, user, config] = await Promise.all([
      cookies(),
      headers(),
      getCurrentUser(),
      getFreeDealConfig(),
    ]);
    const visitor = {
      deviceId: cookieStore.get(FREE_DEAL_DEVICE_COOKIE)?.value,
      ip: resolveRequestIp(headerStore),
      userAgent: headerStore.get("user-agent"),
      userId: user?.id,
      customerEmail: customer.customerEmail,
    };
    const access = await getFreeDealAccessState(visitor, config);

    if (access.status === "disabled") {
      return Response.json({ message: "Cette offre est actuellement indisponible." }, { status: 409 });
    }

    if (access.status === "blocked") {
      return Response.json({ message: "Cette offre est deja utilisee sur cet appareil. Partagez votre lien pour la debloquer." }, { status: 409 });
    }

    const order = await createFreeDealOrder({
      config,
      selectedSlugs,
      customer,
      visitor,
      user,
    });
    const requestOrigin = resolveRequestOrigin(headerStore);
    const siteOrigin = requestOrigin.startsWith("http://localhost") || requestOrigin.startsWith("https://localhost")
      ? requestOrigin
      : new URL(SITE_URL).origin;
    const customerName = splitCustomerName(order.customerName);
    const payment = await initializeMonerooPayment({
      amount: order.totalPriceFcfa,
      currency: order.paymentCurrency || "XOF",
      description: `Paiement offre articles gratuits ${order.orderNumber}`,
      return_url: `${siteOrigin}/articles-gratuits/paiement?orderId=${encodeURIComponent(order.id)}`,
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
        campaign: "free-deal",
      },
      methods: getRequestedMethods(),
    });
    const nextOrder = await persistMonerooPaymentToOrder({ order, payment });

    return Response.json({
      orderId: nextOrder.id,
      checkoutUrl: payment.checkout_url,
      paymentId: payment.id,
      paymentStatus: payment.status,
      order: nextOrder,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Impossible de preparer cette offre.";
    return Response.json({ message }, { status: 400 });
  }
}