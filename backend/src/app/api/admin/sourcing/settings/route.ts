import { NextResponse } from "next/server";

import { getCurrentAdminAccess } from "@/lib/admin-auth";
import { updateSourcingSettings } from "@/lib/sourcing-service";

export async function PUT(request: Request) {
  const adminAccess = await getCurrentAdminAccess().catch(() => null);
  if (!adminAccess) {
    return NextResponse.json({ message: "Connexion admin requise." }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);

  try {
    const settings = await updateSourcingSettings((payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>);
    return NextResponse.json({
      message: "Reglages sourcing enregistres.",
      settings,
    });
  } catch (error) {
    return NextResponse.json({
      message: error instanceof Error ? error.message : "Impossible d'enregistrer les reglages sourcing.",
    }, { status: 422 });
  }
}