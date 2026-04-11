import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { buildGoogleOauthAuthorizeUrl, getGoogleOauthStateCookieConfig, getSafeNextPath, normalizeAuthOrigin } from "@/lib/google-oauth";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const nextPath = getSafeNextPath(requestUrl.searchParams.get("next"));
  const mode = requestUrl.searchParams.get("mode") || "login";

  try {
    const { authorizeUrl, state } = await buildGoogleOauthAuthorizeUrl(request, { nextPath, mode });
    const cookieStore = await cookies();
    cookieStore.set({
      ...getGoogleOauthStateCookieConfig(),
      value: state,
    });

    return NextResponse.redirect(authorizeUrl);
  } catch (error) {
    const fallbackUrl = new URL(mode === "register" ? "/register" : "/login", normalizeAuthOrigin(requestUrl));
    fallbackUrl.searchParams.set("next", nextPath);
    fallbackUrl.searchParams.set("oauth_error", error instanceof Error ? error.message : "Connexion Google indisponible.");
    return NextResponse.redirect(fallbackUrl);
  }
}