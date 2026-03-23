import { NextResponse } from "next/server";

import { getUserSessionCookieConfig } from "@/lib/user-auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(getUserSessionCookieConfig().name, "", {
    ...getUserSessionCookieConfig(),
    maxAge: 0,
  });
  return response;
}