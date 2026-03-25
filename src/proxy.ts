import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

import { FREE_DEAL_DEVICE_COOKIE, FREE_DEAL_ROUTE } from "@/lib/free-deal-constants";
import { parseUserSessionToken, USER_SESSION_COOKIE } from "@/lib/user-session";

const isProtectedRoute = createRouteMatcher([
  "/account(.*)",
  "/checkout(.*)",
  "/orders(.*)",
  "/messages(.*)",
  "/quotes(.*)",
  "/favorites(.*)",
  "/admin(.*)",
  "/api/admin(.*)",
]);

function shouldAttachFreeDealDeviceCookie(pathname: string) {
  return pathname === FREE_DEAL_ROUTE
    || pathname.startsWith(`${FREE_DEAL_ROUTE}/`)
    || pathname.startsWith("/api/free-deals/");
}

function finalizeResponse(request: NextRequest, response: NextResponse) {
  if (!shouldAttachFreeDealDeviceCookie(request.nextUrl.pathname)) {
    return response;
  }

  if (request.cookies.get(FREE_DEAL_DEVICE_COOKIE)?.value) {
    return response;
  }

  response.cookies.set({
    name: FREE_DEAL_DEVICE_COOKIE,
    value: crypto.randomUUID(),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return response;
}

export default clerkMiddleware(async (auth, request) => {
  if (request.nextUrl.pathname === "/admin/login") {
    const loginUrl = new URL("/admin_jacen", request.url);
    return finalizeResponse(request, NextResponse.redirect(loginUrl));
  }

  if (isProtectedRoute(request)) {
    const { userId } = await auth();
    const session = await parseUserSessionToken(request.cookies.get(USER_SESSION_COOKIE)?.value);

    if (!userId && !session?.sub) {
      if (request.nextUrl.pathname.startsWith("/api/")) {
        return finalizeResponse(request, NextResponse.json({ message: "Authentification requise." }, { status: 401 }));
      }

      const loginUrl = new URL(request.nextUrl.pathname.startsWith("/admin") ? "/admin_jacen" : "/login", request.url);
      if (!request.nextUrl.pathname.startsWith("/admin")) {
        loginUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
      }
      return finalizeResponse(request, NextResponse.redirect(loginUrl));
    }
  }

  return finalizeResponse(request, NextResponse.next());
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
