import { NextResponse } from "next/server";

import { validatePromoCodeForAmount } from "@/lib/promo-codes-store";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const code = typeof body?.code === "string" ? body.code : "";
    const totalFcfa = typeof body?.totalFcfa === "number" ? body.totalFcfa : Number(body?.totalFcfa ?? 0);

    if (!code.trim()) {
      return NextResponse.json({ message: "Saisissez un code promo." }, { status: 400 });
    }

    const result = await validatePromoCodeForAmount({ code, totalFcfa });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Impossible de valider ce code promo.";
    return NextResponse.json({ message }, { status: 400 });
  }
}