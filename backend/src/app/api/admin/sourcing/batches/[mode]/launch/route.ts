import { NextResponse } from "next/server";

import { getCurrentAdminAccess } from "@/lib/admin-auth";
import { launchSourcingSupplierPaymentBatch } from "@/lib/sourcing-batch-service";

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

  try {
    const result = await launchSourcingSupplierPaymentBatch(normalizedMode);
    return NextResponse.json({
      message: `Lot ${normalizedMode === "air" ? "avion" : "maritime"} lance.`,
      ...result,
    });
  } catch (error) {
    return NextResponse.json({
      message: error instanceof Error ? error.message : "Impossible de lancer ce lot d'achat.",
    }, { status: 422 });
  }
}