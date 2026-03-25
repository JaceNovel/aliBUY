import { NextResponse } from "next/server";

import { hashUserPassword, getCurrentUser, verifyUserPasswordById } from "@/lib/user-auth";
import { updateStoredUserPassword } from "@/lib/user-store";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: "Connexion requise." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";
  const confirmPassword = typeof body?.confirmPassword === "string" ? body.confirmPassword : "";

  if (newPassword.length < 8) {
    return NextResponse.json({ message: "Le nouveau mot de passe doit contenir au moins 8 caracteres." }, { status: 400 });
  }

  if (newPassword !== confirmPassword) {
    return NextResponse.json({ message: "La confirmation du mot de passe ne correspond pas." }, { status: 400 });
  }

  if (!(await verifyUserPasswordById(user.id, currentPassword))) {
    return NextResponse.json({ message: "Le mot de passe actuel est incorrect." }, { status: 400 });
  }

  const hash = hashUserPassword(newPassword);
  await updateStoredUserPassword({ id: user.id, passwordHash: hash.passwordHash, passwordSalt: hash.passwordSalt });
  return NextResponse.json({ ok: true });
}