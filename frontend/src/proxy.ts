import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

import { FREE_DEAL_DEVICE_COOKIE, FREE_DEAL_ROUTE } from "@/lib/free-deal-constants";
import { parseUserSessionToken, USER_SESSION_COOKIE } from "@/lib/user-session";

const isProtectedRoute = createRouteMatcher([
  "/account(.*)",
  "/checkout(.*)",
  "/orders(.*)",
  "/messages(.*)",
  "/quotes(.*)",
  "/favorites(.*)",
  "/admin",
  "/admin/(.*)",
  "/api/admin(.*)",
]);

const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim());

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

async function handleRequest(request: NextRequest, getClerkUserId?: () => Promise<string | null>) {
  const isAdminPageRequest = request.nextUrl.pathname === "/admin" || request.nextUrl.pathname.startsWith("/admin/");
  const isAdminApiRequest = request.nextUrl.pathname.startsWith("/api/admin");

  if (request.nextUrl.pathname === "/admin/login") {
    return finalizeResponse(request, new NextResponse("Not Found", { status: 404 }));
  }

  if (isProtectedRoute(request)) {
    const userId = getClerkUserId ? await getClerkUserId() : null;
    const session = await parseUserSessionToken(request.cookies.get(USER_SESSION_COOKIE)?.value);

    if (!userId && !session?.sub) {
      if (isAdminPageRequest || isAdminApiRequest) {
        return finalizeResponse(request, new NextResponse("Not Found", { status: 404 }));
      }

      if (request.nextUrl.pathname.startsWith("/api/")) {
        return finalizeResponse(request, NextResponse.json({ message: "Authentification requise." }, { status: 401 }));
      }

      const loginUrl = new URL("/login", request.url);
      if (!isAdminPageRequest) {
        loginUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
      }
      return finalizeResponse(request, NextResponse.redirect(loginUrl));
    }
  }

  return finalizeResponse(request, NextResponse.next());
}

const clerkProxy = clerkMiddleware(async (auth, request) => handleRequest(request, async () => (await auth()).userId ?? null));

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  if (!clerkEnabled) {
    return handleRequest(request);
  }

  return clerkProxy(request, event);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
