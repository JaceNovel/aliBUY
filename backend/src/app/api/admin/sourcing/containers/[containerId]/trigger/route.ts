import { NextResponse } from "next/server";

import { getCurrentAdminAccess } from "@/lib/admin-auth";
type RouteContext = {
  params: Promise<{ containerId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const adminAccess = await getCurrentAdminAccess().catch(() => null);
  if (!adminAccess) {
    return NextResponse.json({ message: "Connexion admin requise." }, { status: 401 });
  }

  await context.params;

  return NextResponse.json({
    message: "Le groupage maritime est desactive. Lancez chaque commande payee depuis sa fiche detail.",
  }, { status: 410 });
}
