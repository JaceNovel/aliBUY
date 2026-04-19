import { NextResponse } from "next/server";

import { getCurrentAdminAccess } from "@/lib/admin-auth";
type RouteContext = {
  params: Promise<{ mode: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const adminAccess = await getCurrentAdminAccess().catch(() => null);
  if (!adminAccess) {
    return NextResponse.json({ message: "Connexion admin requise." }, { status: 401 });
  }

  const { mode } = await context.params;
  const normalizedMode = mode === "air" || mode === "sea" ? mode : null;

  if (!normalizedMode) {
    return NextResponse.json({ message: "Mode de lot invalide." }, { status: 400 });
  }

  return NextResponse.json({
    message: "Le lancement par lot est desactive. Ouvrez la fiche detail d'une commande payee pour lancer son fournisseur.",
  }, { status: 410 });
}
