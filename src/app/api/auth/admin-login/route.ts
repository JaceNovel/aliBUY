import { NextResponse } from "next/server";

import { isAdminEmail, validateAdminCredentials } from "@/lib/admin-auth";
import { createAuthenticatedUserSession, getUserSessionCookieConfig } from "@/lib/user-auth";
import { createStoredUser, getStoredUserByEmail } from "@/lib/user-store";

function deriveAdminDisplayName(email: string) {
  const [localPart] = email.trim().toLowerCase().split("@");
  if (!localPart) {
    return "Administrateur AfriPay";
  }

  return localPart
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ") || "Administrateur AfriPay";
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json({ message: "Adresse e-mail et mot de passe admin requis." }, { status: 400 });
  }

  if (!isAdminEmail(email)) {
    return NextResponse.json({ message: "Cet e-mail n'est pas autorise pour l'administration." }, { status: 403 });
  }

  const isValid = await validateAdminCredentials(email, password).catch(() => false);
  if (!isValid) {
    return NextResponse.json({ message: "Identifiants admin invalides." }, { status: 401 });
  }

  const existingUser = await getStoredUserByEmail(email);
  const user = existingUser ?? await createStoredUser({
    email,
    displayName: deriveAdminDisplayName(email),
  });

  const token = await createAuthenticatedUserSession({
    id: user.id,
    clerkUserId: user.clerkUserId,
    email: user.email,
    displayName: user.displayName,
    firstName: user.firstName,
    createdAt: user.createdAt,
    authProvider: user.clerkUserId ? "clerk" : "legacy",
  });

  const cookieConfig = getUserSessionCookieConfig();
  const response = NextResponse.json({ ok: true, isAdmin: true });
  response.cookies.set(cookieConfig.name, token, cookieConfig);
  return response;
}
