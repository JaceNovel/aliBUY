import { syncUserPhoneChannels } from "@/lib/account-contact-sync";
import { markAbandonedCartRecordCleared } from "@/lib/abandoned-cart-store";
import { getManyChatAccountProfile } from "@/lib/account-manychat";
import { createCheckoutOrder } from "@/lib/sourcing-service";
import { triggerManyChatLogisticsUpdate } from "@/lib/manychat";
import { getCurrentUser } from "@/lib/user-auth";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ message: "Connexion requise." }, { status: 401 });
  }

  try {
    const body = await request.json();
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
