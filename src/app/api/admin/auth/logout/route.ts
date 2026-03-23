import { NextResponse } from "next/server";

import { ADMIN_SESSION_COOKIE, getAdminSessionCookieConfig } from "@/lib/admin-auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    ...getAdminSessionCookieConfig(),
    name: ADMIN_SESSION_COOKIE,
    value: "",
    maxAge: 0,
  });

  return response;
}