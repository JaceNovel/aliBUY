import { NextResponse } from "next/server";

import { isAdminEmail } from "@/lib/admin-auth";
import { createAuthenticatedUserSession, getUserSessionCookieConfig, validateUserCredentials } from "@/lib/user-auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email : "";
  const password = typeof body?.password === "string" ? body.password : "";

  const user = await validateUserCredentials(email, password);
  if (!user) {
    return NextResponse.json({ message: "Identifiants invalides." }, { status: 401 });
  }

  const token = await createAuthenticatedUserSession(user);
  const response = NextResponse.json({ ok: true, user, isAdmin: isAdminEmail(user.email) });
  response.cookies.set(getUserSessionCookieConfig().name, token, getUserSessionCookieConfig());
  return response;
}