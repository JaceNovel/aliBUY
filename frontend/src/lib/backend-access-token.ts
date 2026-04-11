import "server-only";

import { cookies } from "next/headers";

export const BACKEND_ACCESS_TOKEN_COOKIE = "afripay_backend_access_token";

export function getBackendAccessTokenCookieConfig() {
  return {
    name: BACKEND_ACCESS_TOKEN_COOKIE,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  };
}

export async function getBackendAccessTokenFromCookies() {
  const cookieStore = await cookies();
  return cookieStore.get(BACKEND_ACCESS_TOKEN_COOKIE)?.value?.trim() || "";
}