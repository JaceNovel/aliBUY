import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getForceLoggedOutCookieConfig } from "@/lib/auth-session-flags";
import { getBackendAccessTokenCookieConfig } from "@/lib/backend-access-token";
import { getGoogleOauthStateCookieConfig } from "@/lib/google-oauth";
import { getUserSessionCookieConfig } from "@/lib/user-auth";

export async function POST() {
  const cookieStore = await cookies();
  const sessionCookie = getUserSessionCookieConfig();
  const backendAccessTokenCookie = getBackendAccessTokenCookieConfig();
  const googleStateCookie = getGoogleOauthStateCookieConfig();
  const forceLoggedOutCookie = getForceLoggedOutCookieConfig();

  cookieStore.set({ ...sessionCookie, value: "", maxAge: 0 });
  cookieStore.set({ ...backendAccessTokenCookie, value: "", maxAge: 0 });
  cookieStore.set({ ...googleStateCookie, value: "", maxAge: 0 });
  cookieStore.set({ ...forceLoggedOutCookie, value: "1" });

  return NextResponse.json({ ok: true });
}