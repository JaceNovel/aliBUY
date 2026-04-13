export const FORCE_LOGGED_OUT_COOKIE = "afripay_force_logged_out";

export function getForceLoggedOutCookieConfig() {
  return {
    name: FORCE_LOGGED_OUT_COOKIE,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  };
}
