import { NextResponse } from "next/server";

import { createAuthenticatedUserSession, getUserSessionCookieConfig, registerUser } from "@/lib/user-auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const displayName = typeof body?.displayName === "string" ? body.displayName : "";
  const email = typeof body?.email === "string" ? body.email : "";
  const password = typeof body?.password === "string" ? body.password : "";

  try {
    const user = await registerUser({ displayName, email, password });
    const token = await createAuthenticatedUserSession(user);
    const response = NextResponse.json({ ok: true, user }, { status: 201 });
    response.cookies.set(getUserSessionCookieConfig().name, token, getUserSessionCookieConfig());
    return response;
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Inscription impossible." }, { status: 400 });
  }
}