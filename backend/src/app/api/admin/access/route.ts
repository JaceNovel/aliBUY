import { NextResponse } from "next/server";

import { hasAdminPermission } from "@/lib/admin-auth";
import { getAdminAccessRecords, upsertAdminAccess } from "@/lib/admin-access-store";

export async function GET() {
  if (!(await hasAdminPermission("admin.manage"))) {
    return NextResponse.json({ message: "Accès refusé." }, { status: 403 });
  }

  return NextResponse.json(await getAdminAccessRecords());
}

export async function PUT(request: Request) {
  if (!(await hasAdminPermission("admin.manage"))) {
    return NextResponse.json({ message: "Accès refusé." }, { status: 403 });
  }

  try {
    const payload = await request.json().catch(() => null);
    if (!payload || typeof payload !== "object") {
      return NextResponse.json({ message: "Accès admin invalide." }, { status: 400 });
    }

    const record = await upsertAdminAccess(payload as Parameters<typeof upsertAdminAccess>[0]);
    return NextResponse.json(record);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Impossible d'enregistrer l'accès admin.";
    return NextResponse.json({ message }, { status: 400 });
  }
}