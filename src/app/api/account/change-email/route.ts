import { NextResponse } from "next/server";

import { createAuthenticatedUserSession, getCurrentUser, getUserSessionCookieConfig, verifyUserPasswordById } from "@/lib/user-auth";
import { updateStoredUserEmail } from "@/lib/user-store";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: "Connexion requise." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const newEmail = typeof body?.newEmail === "string" ? body.newEmail.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
    return NextResponse.json({ message: "La nouvelle adresse e-mail est invalide." }, { status: 400 });
  }

  if (user.clerkUserId) {
    return NextResponse.json({ message: "Cette adresse e-mail est gérée par Clerk. Utilisez l'icône de profil en haut du site pour la modifier et la valider." }, { status: 400 });
  }

  if (!(await verifyUserPasswordById(user.id, password))) {
    return NextResponse.json({ message: "Mot de passe incorrect." }, { status: 400 });
  }

  const updatedUser = await updateStoredUserEmail({ id: user.id, email: newEmail });
  const token = await createAuthenticatedUserSession({
    id: updatedUser.id,
    clerkUserId: updatedUser.clerkUserId,
    email: updatedUser.email,
    displayName: updatedUser.displayName,
    firstName: updatedUser.firstName,
    createdAt: updatedUser.createdAt,
    authProvider: updatedUser.clerkUserId ? "clerk" : "legacy",
  });

  const response = NextResponse.json({ ok: true, email: updatedUser.email });
  response.cookies.set(getUserSessionCookieConfig().name, token, getUserSessionCookieConfig());
  return response;
}