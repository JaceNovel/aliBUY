import { NextResponse } from "next/server";

import { hasAdminPermission } from "@/lib/admin-auth";
import { deleteAdminAccess } from "@/lib/admin-access-store";

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await hasAdminPermission("admin.manage"))) {
    return NextResponse.json({ message: "Accès refusé." }, { status: 403 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ message: "Identifiant manquant." }, { status: 400 });
  }

  await deleteAdminAccess(id);
  return NextResponse.json({ ok: true });
}