import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getGoogleOauthStateCookieConfig } from "@/lib/google-oauth";
import { getUserSessionCookieConfig } from "@/lib/user-auth";

export async function POST() {
  const cookieStore = await cookies();
  const sessionCookie = getUserSessionCookieConfig();
  const googleStateCookie = getGoogleOauthStateCookieConfig();

  cookieStore.set({ ...sessionCookie, value: "", maxAge: 0 });
  cookieStore.set({ ...googleStateCookie, value: "", maxAge: 0 });

  return NextResponse.json({ ok: true });
}