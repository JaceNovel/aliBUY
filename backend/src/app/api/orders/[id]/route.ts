import { getSourcingOrderById } from "@/lib/sourcing-store";
import { getSourcingOrderMeta } from "@/lib/alibaba-sourcing";
import { getCurrentUser } from "@/lib/user-auth";

function normalizeEmail(value?: string) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ message: "Connexion requise." }, { status: 401 });
  }

  const { id } = await context.params;
  const order = await getSourcingOrderById(id);

  if (!order) {
    return Response.json({ message: "Commande sourcing introuvable." }, { status: 404 });
  }

  const meta = getSourcingOrderMeta(order);
  const normalizedUserEmail = normalizeEmail(user.email);
  const viewerMatchesSharedCart = Boolean(
    meta.sharedCart?.ownerUserId === user.id
    || normalizeEmail(meta.sharedCart?.ownerEmail) === normalizedUserEmail
    || meta.paymentContext?.payerUserId === user.id
    || normalizeEmail(meta.paymentContext?.payerEmail) === normalizedUserEmail
  );

  if (!(order.userId === user.id || normalizeEmail(order.customerEmail) === normalizedUserEmail || viewerMatchesSharedCart)) {
    return Response.json({ message: "Acces refuse." }, { status: 403 });
  }

  return Response.json({ order });
}
