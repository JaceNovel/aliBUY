import { NextResponse, type NextRequest } from "next/server";

const ADMIN_SESSION_COOKIE = "afripay_admin_session";
const DEFAULT_ADMIN_EMAIL = "afripay@gmail.com";
const DEFAULT_ADMIN_PASSWORD_HASH = "ab2fd8441f2f7aaf64ccc6a886ff55fb2297ab754b63220b86896a36eab51501";

function encoder() {
  return new TextEncoder();
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function getAdminEmail() {
  return process.env.ADMIN_EMAIL?.trim() || DEFAULT_ADMIN_EMAIL;
}

function getAdminPasswordHash() {
  return process.env.ADMIN_PASSWORD_HASH?.trim() || DEFAULT_ADMIN_PASSWORD_HASH;
}

function getAdminSessionSecret() {
  return process.env.ADMIN_SESSION_SECRET?.trim() || process.env.APP_KEY?.trim() || getAdminPasswordHash();
}

async function createAdminSessionToken() {
  return sha256Hex(`${getAdminEmail()}:${getAdminPasswordHash()}:${getAdminSessionSecret()}:afripay-admin`);
}

function isAllowedWithoutAuth(pathname: string) {
  return pathname === "/admin/login"
    || pathname === "/api/admin/auth/login"
    || pathname === "/api/admin/auth/logout"
    || pathname === "/api/admin/alibaba/oauth/callback";
}

function isApiPath(pathname: string) {
  return pathname.startsWith("/api/");
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const cookieToken = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const isAuthenticated = cookieToken === await createAdminSessionToken();

  if (pathname === "/admin/login" && isAuthenticated) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  if (isAllowedWithoutAuth(pathname)) {
    return NextResponse.next();
  }

  if (isAuthenticated) {
    return NextResponse.next();
  }

  if (isApiPath(pathname)) {
    return NextResponse.json({ message: "Authentification admin requise." }, { status: 401 });
  }

  const loginUrl = new URL("/admin/login", request.url);
  loginUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};