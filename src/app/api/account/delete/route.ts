import { NextResponse } from "next/server";

import { clerkClient } from "@clerk/nextjs/server";

import { deleteAccountSettings } from "@/lib/account-settings-store";
import { getCurrentUser, getUserSessionCookieConfig, verifyUserPasswordById } from "@/lib/user-auth";
import { deleteStoredUser } from "@/lib/user-store";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: "Connexion requise." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const confirmation = typeof body?.confirmation === "string" ? body.confirmation.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (confirmation !== "SUPPRIMER") {
    return NextResponse.json({ message: "Tapez SUPPRIMER pour confirmer." }, { status: 400 });
  }

  if (!user.clerkUserId && !(await verifyUserPasswordById(user.id, password))) {
    return NextResponse.json({ message: "Mot de passe incorrect." }, { status: 400 });
  }

  if (user.clerkUserId) {
    const client = await clerkClient();
    await client.users.deleteUser(user.clerkUserId);
  }

  await deleteAccountSettings(user.id);
  await deleteStoredUser(user.id);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(getUserSessionCookieConfig().name, "", {
    ...getUserSessionCookieConfig(),
    maxAge: 0,
  });
  return response;
}
