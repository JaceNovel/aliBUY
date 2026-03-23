import { NextResponse } from "next/server";

import { createAdminSessionToken, getAdminSessionCookieConfig, validateAdminCredentials } from "@/lib/admin-auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = typeof body?.email === "string" ? body.email : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!(await validateAdminCredentials(email, password))) {
    return NextResponse.json({ message: "Identifiants admin invalides." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    ...getAdminSessionCookieConfig(),
    value: await createAdminSessionToken(),
  });

  return response;
}