import { getSourcingOrderById } from "@/lib/sourcing-store";
import { getCurrentUser } from "@/lib/user-auth";

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

  if (!(order.userId === user.id || order.customerEmail.toLowerCase() === user.email.toLowerCase())) {
    return Response.json({ message: "Acces refuse." }, { status: 403 });
  }

  return Response.json({ order });
}