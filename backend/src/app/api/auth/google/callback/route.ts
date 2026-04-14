import { NextResponse } from "next/server";

import { getSafeNextPath } from "@/lib/auth-navigation";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const nextPath = getSafeNextPath(requestUrl.searchParams.get("next"));
  const target = new URL("/login", requestUrl.origin);
  target.searchParams.set("next", nextPath);
  target.searchParams.set("oauth_error", "Cette ancienne connexion Google est obsolete. Utilisez la connexion Clerk.");
  return NextResponse.redirect(target);
}
