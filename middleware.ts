import { NextResponse, type NextRequest } from "next/server";

import { parseUserSessionToken, USER_SESSION_COOKIE } from "@/lib/user-session";

const ADMIN_SESSION_COOKIE = "afripay_admin_session";

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
  return process.env.ADMIN_EMAIL?.trim() || "";
}

function getAdminPasswordHash() {
  return process.env.ADMIN_PASSWORD_HASH?.trim() || "";
}

function getAdminSessionSecret() {
  return process.env.ADMIN_SESSION_SECRET?.trim() || process.env.APP_KEY?.trim() || "";
}

function isAdminAuthConfigured() {
  return Boolean(getAdminEmail() && getAdminPasswordHash() && getAdminSessionSecret());
}

async function createAdminSessionToken() {
  if (!isAdminAuthConfigured()) {
    return "";
  }

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

function isUserAuthPage(pathname: string) {
  return pathname === "/login" || pathname === "/register";
}

function isProtectedUserPath(pathname: string) {
  return pathname === "/account"
    || pathname.startsWith("/account/")
    || pathname === "/checkout"
    || pathname.startsWith("/checkout/")
    || pathname === "/orders"
    || pathname.startsWith("/orders/")
    || pathname === "/messages"
    || pathname.startsWith("/messages/")
    || pathname === "/quotes"
    || pathname.startsWith("/quotes/")
    || pathname === "/favorites"
    || pathname.startsWith("/favorites/");
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const cookieToken = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const isAuthenticated = isAdminAuthConfigured() && cookieToken === await createAdminSessionToken();
  const userSession = await parseUserSessionToken(request.cookies.get(USER_SESSION_COOKIE)?.value);
  const isUserAuthenticated = Boolean(userSession);

  if (pathname === "/admin/login" && isAuthenticated) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  if (isAllowedWithoutAuth(pathname)) {
    return NextResponse.next();
  }

  if (isUserAuthPage(pathname) && isUserAuthenticated) {
    return NextResponse.redirect(new URL("/account", request.url));
  }

  if (isProtectedUserPath(pathname) && !isUserAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
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
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*",
    "/login",
    "/register",
    "/account/:path*",
    "/checkout/:path*",
    "/orders/:path*",
    "/messages/:path*",
    "/quotes/:path*",
    "/favorites/:path*",
  ],
};