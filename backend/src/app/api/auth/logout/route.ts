import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getForceLoggedOutCookieConfig } from "@/lib/auth-session-flags";
import { getBackendAccessTokenCookieConfig } from "@/lib/backend-access-token";
import { getUserSessionCookieConfig } from "@/lib/user-auth";

const LEGACY_GOOGLE_OAUTH_STATE_COOKIE = "afripay_google_oauth_state";

export async function POST() {
  const cookieStore = await cookies();
  const sessionCookie = getUserSessionCookieConfig();
  const backendAccessTokenCookie = getBackendAccessTokenCookieConfig();
  const forceLoggedOutCookie = getForceLoggedOutCookieConfig();

  cookieStore.set({ ...sessionCookie, value: "", maxAge: 0 });
  cookieStore.set({ ...backendAccessTokenCookie, value: "", maxAge: 0 });
  cookieStore.set({ name: LEGACY_GOOGLE_OAUTH_STATE_COOKIE, value: "", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
  cookieStore.set({ ...forceLoggedOutCookie, value: "1" });

  return NextResponse.json({ ok: true });
}
