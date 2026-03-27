import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/admin-auth";
import { deletePromoCode, getPromoCodes, upsertPromoCode } from "@/lib/promo-codes-store";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ message: "Accès refusé." }, { status: 403 });
  }

  return NextResponse.json(await getPromoCodes());
}

export async function PUT(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ message: "Accès refusé." }, { status: 403 });
  }

  try {
    const payload = await request.json().catch(() => null);
    if (!payload || typeof payload !== "object") {
      return NextResponse.json({ message: "Code promo invalide." }, { status: 400 });
    }

    const promoCode = await upsertPromoCode(payload as Parameters<typeof upsertPromoCode>[0]);
    return NextResponse.json(promoCode);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Impossible d'enregistrer le code promo.";
    return NextResponse.json({ message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ message: "Accès refusé." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const codeOrId = typeof body?.codeOrId === "string" ? body.codeOrId : "";
  if (!codeOrId.trim()) {
    return NextResponse.json({ message: "Code promo manquant." }, { status: 400 });
  }

  const promoCodes = await deletePromoCode(codeOrId);
  return NextResponse.json(promoCodes);
}