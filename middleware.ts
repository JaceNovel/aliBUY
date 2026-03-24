import { NextResponse, type NextRequest } from "next/server";

import { isAdminEmail } from "@/lib/admin-auth";
import { parseUserSessionToken, USER_SESSION_COOKIE } from "@/lib/user-session";

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
  const userSession = await parseUserSessionToken(request.cookies.get(USER_SESSION_COOKIE)?.value);
  const isUserAuthenticated = Boolean(userSession);
  const isAdminAuthenticated = isAdminEmail(userSession?.email);

  if (pathname === "/admin/login") {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", "/admin");
    return NextResponse.redirect(loginUrl);
  }

  if (isUserAuthPage(pathname) && isUserAuthenticated) {
    return NextResponse.redirect(new URL(isAdminAuthenticated ? "/admin" : "/account", request.url));
  }

  if (isProtectedUserPath(pathname) && !isUserAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    if (!isUserAuthenticated) {
      if (isApiPath(pathname)) {
        return NextResponse.json({ message: "Authentification requise." }, { status: 401 });
      }

      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", `${pathname}${search}`);
      return NextResponse.redirect(loginUrl);
    }

    if (!isAdminAuthenticated) {
      if (isApiPath(pathname)) {
        return NextResponse.json({ message: "Acces admin requis." }, { status: 403 });
      }

      return NextResponse.redirect(new URL("/account", request.url));
    }

    return NextResponse.next();
  }

  return NextResponse.next();
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