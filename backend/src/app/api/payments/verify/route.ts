import { API_URL, buildApiUrl } from "@/lib/api";
import { verifyMonerooPayment } from "@/lib/moneroo";
import { persistMonerooPaymentToOrder } from "@/lib/moneroo-sourcing";
import { syncSourcingOrderForDeferredSupplierPayment } from "@/lib/sourcing-batch-service";
import { getSourcingOrderById } from "@/lib/sourcing-store";
import { getCurrentUser } from "@/lib/user-auth";

async function resolveAuthenticatedUser() {
  try {
    return { user: await getCurrentUser(), hasAuthError: false };
  } catch {
    return { user: null, hasAuthError: true };
  }
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

  const upstreamUrl = buildApiUrl("/api/payments/verify");
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

    if (upstreamResponse.status >= 500) {
      console.warn("[payments/verify] upstream unavailable, fallback to local handler", {
        upstreamUrl,
        status: upstreamResponse.status,
      });
      return null;
    }

    if (upstreamResponse.status === 404) {
      console.warn("[payments/verify] upstream order missing, fallback to local handler", {
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
    console.warn("[payments/verify] upstream request failed, fallback to local handler", {
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