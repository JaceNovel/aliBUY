import { createCheckoutOrder } from "@/lib/sourcing-service";
import { getCurrentUser } from "@/lib/user-auth";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ message: "Connexion requise." }, { status: 401 });
  }

  try {
    const body = await request.json();

    const order = await createCheckoutOrder({
      userId: user.id,
      customerAddressId: body?.customerAddressId ? String(body.customerAddressId) : undefined,
      customerName: String(body?.customerName ?? user.displayName),
      customerEmail: String(body?.customerEmail ?? user.email),
      customerPhone: String(body?.customerPhone ?? ""),
      googleMapsUrl: body?.googleMapsUrl ? String(body.googleMapsUrl) : undefined,
      addressLine1: String(body?.addressLine1 ?? ""),
      addressLine2: body?.addressLine2 ? String(body.addressLine2) : undefined,
      city: String(body?.city ?? ""),
      state: String(body?.state ?? ""),
      postalCode: body?.postalCode ? String(body.postalCode) : undefined,
      countryCode: String(body?.countryCode ?? "CI"),
      deliveryProfile: typeof body?.deliveryProfile === "object" && body.deliveryProfile ? body.deliveryProfile : undefined,
      shippingMethod: body?.shippingMethod === "sea" ? "sea" : "air",
      notes: body?.notes ? String(body.notes) : undefined,
      items: Array.isArray(body?.items) ? body.items : [],
    });

    return Response.json({ order });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Impossible de créer la commande sourcing.";
    return Response.json({ message }, { status: 400 });
  }
}