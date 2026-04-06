import { API_URL, buildApiUrl } from "@/lib/api";
import { initializeMonerooPayment } from "@/lib/moneroo";
import { persistMonerooPaymentToOrder } from "@/lib/moneroo-sourcing";
import { SITE_URL } from "@/lib/site-config";
import { getSourcingOrderByReference } from "@/lib/sourcing-store";
import { getCurrentUser } from "@/lib/user-auth";

async function resolveAuthenticatedUser() {
  try {
    return { user: await getCurrentUser(), hasAuthError: false };
  } catch {
    return { user: null, hasAuthError: true };
  }
}

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

  const upstreamUrl = buildApiUrl("/api/payments/init");
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

    if (upstreamResponse.status === 401 || upstreamResponse.status === 403) {
      console.warn("[payments/init] upstream auth unavailable, fallback to local handler", {
        upstreamUrl,
        status: upstreamResponse.status,
      });
      return null;
    }

    if (upstreamResponse.status >= 500) {
      console.warn("[payments/init] upstream unavailable, fallback to local handler", {
        upstreamUrl,
        status: upstreamResponse.status,
      });
      return null;
    }

    if (upstreamResponse.status === 404) {
      console.warn("[payments/init] upstream order missing, fallback to local handler", {
        upstreamUrl,
      });
      return null;
    }

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
    console.warn("[payments/init] upstream request failed, fallback to local handler", {
      upstreamUrl,
      reason: error instanceof Error ? error.message : "unknown",
    });
    return null;
  }

  return null;
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const proxied = await maybeProxy(request, rawBody);
  if (proxied) {
    return proxied;
  }

  const authState = await resolveAuthenticatedUser();
  if (authState.hasAuthError) {
    return Response.json({ message: "Impossible de valider la session utilisateur." }, { status: 503 });
  }

  const user = authState.user;
  if (!user) {
    return Response.json({ message: "Connexion requise." }, { status: 401 });
  }

  try {
    const body = rawBody ? JSON.parse(rawBody) : {};
    const orderId = typeof body?.orderId === "string" ? body.orderId : "";
    const order = await getSourcingOrderByReference(orderId);

    if (!order) {
      return Response.json({ message: "Commande sourcing introuvable." }, { status: 404 });
    }

    if (!(order.userId === user.id || order.customerEmail.toLowerCase() === user.email.toLowerCase())) {
      return Response.json({ message: "Acces refuse." }, { status: 403 });
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

    const siteOrigin = new URL(SITE_URL).origin;
    const customerName = splitCustomerName(order.customerName);
    const payment = await initializeMonerooPayment({
      amount: order.totalPriceFcfa,
      currency: order.paymentCurrency || "XOF",
      description: `Paiement commande sourcing ${order.orderNumber}`,
      return_url: `${siteOrigin}/orders?orderId=${encodeURIComponent(order.id)}`,
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
