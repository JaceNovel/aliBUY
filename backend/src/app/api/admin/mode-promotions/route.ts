import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getModePromotionConfig, saveModePromotionConfig } from "@/lib/mode-promotions-store";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ message: "Accès refusé." }, { status: 403 });
  }

  const config = await getModePromotionConfig();
  return NextResponse.json(config);
}

export async function PUT(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ message: "Accès refusé." }, { status: 403 });
  }

  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ message: "Configuration invalide." }, { status: 400 });
  }

  const config = await saveModePromotionConfig(payload as Awaited<ReturnType<typeof getModePromotionConfig>>);
  return NextResponse.json(config);
}