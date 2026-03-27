import { NextResponse } from "next/server";

import { getUserSessionCookieConfig } from "@/lib/user-auth";

export async function POST() {
  const cookieConfig = getUserSessionCookieConfig();
  const response = NextResponse.json({ ok: true });

  response.cookies.set(cookieConfig.name, "", {
    ...cookieConfig,
    maxAge: 0,
  });

  return response;
}
