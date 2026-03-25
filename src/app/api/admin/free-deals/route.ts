import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getFreeDealAdminSummary, saveFreeDealConfig } from "@/lib/free-deal-store";

export const runtime = "nodejs";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ message: "Acces refuse." }, { status: 403 });
  }

  const summary = await getFreeDealAdminSummary();
  return NextResponse.json(summary);
}

export async function PUT(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ message: "Acces refuse." }, { status: 403 });
  }

  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ message: "Configuration invalide." }, { status: 400 });
  }

  const config = await saveFreeDealConfig(payload);
  return NextResponse.json({ config });
}
