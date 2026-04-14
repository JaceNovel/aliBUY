import { NextResponse } from "next/server";

import { getSafeNextPath } from "@/lib/auth-navigation";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const nextPath = getSafeNextPath(requestUrl.searchParams.get("next"));
  const mode = requestUrl.searchParams.get("mode") || "login";
  const fallbackUrl = new URL(mode === "register" ? "/register" : "/login", requestUrl.origin);
  fallbackUrl.searchParams.set("next", nextPath);
  fallbackUrl.searchParams.set("oauth_error", "Cette ancienne connexion Google est obsolete. Utilisez la connexion Clerk.");
  return NextResponse.redirect(fallbackUrl);
}
