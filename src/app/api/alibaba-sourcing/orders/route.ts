import { createCheckoutOrder } from "@/lib/sourcing-service";
import { getCurrentUser } from "@/lib/user-auth";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ message: "Connexion requise." }, { status: 401 });
  }

  const body = await request.json();

  const order = await createCheckoutOrder({
    userId: user.id,
    customerName: String(body?.customerName ?? user.displayName),
    customerEmail: String(body?.customerEmail ?? user.email),
    customerPhone: String(body?.customerPhone ?? ""),
    addressLine1: String(body?.addressLine1 ?? ""),
    addressLine2: body?.addressLine2 ? String(body.addressLine2) : undefined,
    city: String(body?.city ?? ""),
    state: String(body?.state ?? ""),
    postalCode: body?.postalCode ? String(body.postalCode) : undefined,
    countryCode: String(body?.countryCode ?? "CI"),
    shippingMethod: body?.shippingMethod === "sea" ? "sea" : "air",
    notes: body?.notes ? String(body.notes) : undefined,
    items: Array.isArray(body?.items) ? body.items : [],
  });

  return Response.json({ order });
}