import { API_URL, buildApiUrl } from "@/lib/api";
import { syncUserPhoneChannels } from "@/lib/account-contact-sync";
import { markAbandonedCartRecordCleared } from "@/lib/abandoned-cart-store";
import { getManyChatAccountProfile } from "@/lib/account-manychat";
import { getUserOrderRecords } from "@/lib/order-service";
import { buildAuthenticatedProxyHeaders } from "@/lib/proxy-auth";
import { validateMutationOrigin } from "@/lib/request-security";
import { createCheckoutOrder } from "@/lib/sourcing-service";
import { triggerManyChatLogisticsUpdate } from "@/lib/manychat";
import { getCurrentUser } from "@/lib/user-auth";

async function maybeProxy(request: Request, rawBody: string) {
  if (!API_URL) {
    return null;
  }

  const upstreamUrl = buildApiUrl("/api/orders");
  const currentUrl = new URL(request.url);
  const upstreamHost = new URL(upstreamUrl).host;

  if (!upstreamHost || upstreamHost === currentUrl.host) {
    return null;
  }

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      method: "POST",
      headers: await buildAuthenticatedProxyHeaders(request, {
        "content-type": "application/json",
      }),
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
      message: rawPayload.trim() || `Orders API request failed with status ${upstreamResponse.status}.`,
    }, { status: upstreamResponse.status });
  } catch {
    return null;
  }
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ message: "Connexion requise." }, { status: 401 });
  }

  const orders = await getUserOrderRecords(user, { preferProxy: false });
  return Response.json({ orders });
}

export async function POST(request: Request) {
  const originError = validateMutationOrigin(request, { allowMissingOrigin: true });
  if (originError) {
    return originError;
  }

  const rawBody = await request.text();
  const proxied = await maybeProxy(request, rawBody);
  if (proxied) {
    return proxied;
  }

  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ message: "Connexion requise." }, { status: 401 });
  }

  try {
    const body = rawBody ? JSON.parse(rawBody) : {};
    const persistedUserId = user.id.startsWith("admin:") ? undefined : user.id;
    const manychatProfile = await getManyChatAccountProfile(user);

    const customerPhone = String(body?.customerPhone ?? "");
    const order = await createCheckoutOrder({
      userId: persistedUserId,
      customerAddressId: persistedUserId && body?.customerAddressId ? String(body.customerAddressId) : undefined,
      customerName: String(body?.customerName ?? user.displayName),
      customerEmail: String(body?.customerEmail ?? user.email),
      customerPhone,
      googleMapsUrl: body?.googleMapsUrl ? String(body.googleMapsUrl) : undefined,
      addressLine1: String(body?.addressLine1 ?? ""),
      addressLine2: body?.addressLine2 ? String(body.addressLine2) : undefined,
      city: String(body?.city ?? ""),
      state: String(body?.state ?? ""),
      postalCode: body?.postalCode ? String(body.postalCode) : undefined,
      countryCode: String(body?.countryCode ?? "CI"),
      deliveryProfile: typeof body?.deliveryProfile === "object" && body.deliveryProfile ? body.deliveryProfile : undefined,
      shippingMethod: body?.shippingMethod === "sea" ? "sea" : body?.shippingMethod === "freight" ? "freight" : "air",
      paymentMethod: body?.paymentMethod === "mobile" || body?.paymentMethod === "pay_on_delivery" ? body.paymentMethod : "card",
      payOnDeliveryIdentityFirstName: body?.payOnDeliveryIdentityFirstName ? String(body.payOnDeliveryIdentityFirstName) : undefined,
      payOnDeliveryIdentityLastName: body?.payOnDeliveryIdentityLastName ? String(body.payOnDeliveryIdentityLastName) : undefined,
      notes: body?.notes ? String(body.notes) : undefined,
      promoCode: body?.promoCode ? String(body.promoCode) : undefined,
      sharedCartToken: body?.sharedCartToken ? String(body.sharedCartToken) : undefined,
      payerDisplayName: user.displayName,
      payerEmail: user.email,
      manychatSubscriberId: manychatProfile.manychatSubscriberId,
      manychatFlowId: manychatProfile.manychatFlowId,
      manychatPaidTagId: manychatProfile.manychatPaidTagId,
      items: Array.isArray(body?.items) ? body.items : [],
    });

    await syncUserPhoneChannels(user, {
      phone: customerPhone,
      usePhoneAsWhatsappByDefault: true,
    });
    await markAbandonedCartRecordCleared(user.id, "converted").catch(() => null);
    await triggerManyChatLogisticsUpdate(order, {
      title: "Commande creee",
      detail: "Votre commande a ete enregistree. Nous preparons maintenant la suite du traitement et de la logistique.",
    }).catch(() => null);

    return Response.json({ order });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Impossible de creer la commande sourcing.";
    return Response.json({ message }, { status: 400 });
  }
}
