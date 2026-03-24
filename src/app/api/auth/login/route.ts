import { NextResponse } from "next/server";

import { isAdminAuthConfigured, isAdminEmail } from "@/lib/admin-auth";
import { createAuthenticatedUserSession, getUserSessionCookieConfig, validateUserCredentials } from "@/lib/user-auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const nextPath = typeof body?.nextPath === "string" ? body.nextPath : "";
  const expectsAdminAccess = nextPath.startsWith("/admin");

  if (expectsAdminAccess && !isAdminAuthConfigured()) {
    return NextResponse.json({ message: "Connexion admin impossible: la configuration ADMIN_EMAIL / ADMIN_PASSWORD_HASH est absente dans l'environnement." }, { status: 500 });
  }

  const user = await validateUserCredentials(email, password);
  if (!user) {
    return NextResponse.json({ message: "Identifiants invalides." }, { status: 401 });
  }

  let token = "";

  try {
    token = await createAuthenticatedUserSession(user);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Configuration session utilisateur incomplète. Définissez USER_SESSION_SECRET ou APP_KEY." }, { status: 500 });
  }

  const response = NextResponse.json({ ok: true, user, isAdmin: isAdminEmail(user.email) });
  response.cookies.set(getUserSessionCookieConfig().name, token, getUserSessionCookieConfig());
  return response;
}