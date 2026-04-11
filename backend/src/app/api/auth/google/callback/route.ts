import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getBackendAccessTokenCookieConfig } from "@/lib/backend-access-token";
import { getBackendBearerToken, provisionBackendGoogleUser } from "@/lib/backend-auth-client";
import { exchangeGoogleOauthCode, getGoogleOauthStateCookieConfig, getPublicAuthRequestUrl, normalizeAuthOrigin, parseGoogleOauthState } from "@/lib/google-oauth";
import { hasConfiguredDatabaseUrl } from "@/lib/prisma";
import { createUserSessionToken } from "@/lib/user-session";
import { createAuthenticatedUserSession, getCurrentUser, getUserSessionCookieConfig, registerUser } from "@/lib/user-auth";

function redirectWithError(requestUrl: URL, mode: "login" | "register", nextPath: string, message: string) {
  const target = new URL(mode === "register" ? "/register" : "/login", normalizeAuthOrigin(requestUrl));
  target.searchParams.set("next", nextPath);
  target.searchParams.set("oauth_error", message);
  return NextResponse.redirect(target);
}

export async function GET(request: Request) {
  const requestUrl = getPublicAuthRequestUrl(request);
  const code = requestUrl.searchParams.get("code") || "";
  const state = requestUrl.searchParams.get("state") || "";
  const cookieStore = await cookies();
  const storedState = cookieStore.get(getGoogleOauthStateCookieConfig().name)?.value || "";

  const parsedState = await parseGoogleOauthState(state);
  const parsedStoredState = await parseGoogleOauthState(storedState);

  cookieStore.set({ ...getGoogleOauthStateCookieConfig(), value: "", maxAge: 0 });

  const mode = parsedState?.mode || parsedStoredState?.mode || "login";
  const nextPath = parsedState?.nextPath || parsedStoredState?.nextPath || "/account";

  if (!code) {
    return redirectWithError(requestUrl, mode, nextPath, "Code Google manquant.");
  }

  if (!parsedState || !parsedStoredState || state !== storedState || parsedState.nonce !== parsedStoredState.nonce) {
    return redirectWithError(requestUrl, mode, nextPath, "Etat OAuth invalide. Recommencez la connexion Google.");
  }

  try {
    const profile = await exchangeGoogleOauthCode(request, code);

    if (!hasConfiguredDatabaseUrl()) {
      const backendProvision = await provisionBackendGoogleUser(request, {
        email: profile.email,
        displayName: profile.displayName,
      }).catch(() => null);

      const token = await createUserSessionToken({
        id: `google:${profile.googleUserId || profile.email}`,
        email: profile.email,
        displayName: profile.displayName,
      });

      cookieStore.set({
        ...getUserSessionCookieConfig(),
        value: token,
      });

      const backendBearerToken = getBackendBearerToken(backendProvision);
      if (backendBearerToken) {
        cookieStore.set({
          ...getBackendAccessTokenCookieConfig(),
          value: backendBearerToken,
        });
      }

      return NextResponse.redirect(new URL(nextPath, normalizeAuthOrigin(requestUrl)));
    }

    let user = await getCurrentUser();

    if (!user || user.email !== profile.email) {
      user = await registerUser({
        email: profile.email,
        displayName: profile.displayName,
        password: crypto.randomUUID(),
      }).catch(async (error) => {
        const message = error instanceof Error ? error.message : "Connexion Google impossible.";
        if (!message.includes("Un compte existe deja")) {
          throw error;
        }

        const existingUserModule = await import("@/lib/user-store");
        const existingUser = await existingUserModule.getStoredUserByEmail(profile.email);
        if (!existingUser) {
          throw error;
        }

        return {
          id: existingUser.id,
          clerkUserId: existingUser.clerkUserId,
          email: existingUser.email,
          displayName: existingUser.displayName,
          firstName: existingUser.firstName,
          createdAt: existingUser.createdAt,
          authProvider: existingUser.clerkUserId ? "clerk" as const : "legacy" as const,
        };
      });
    }

    const token = await createAuthenticatedUserSession(user);
    cookieStore.set({
      ...getUserSessionCookieConfig(),
      value: token,
    });

    return NextResponse.redirect(new URL(nextPath, normalizeAuthOrigin(requestUrl)));
  } catch (error) {
    return redirectWithError(requestUrl, mode, nextPath, error instanceof Error ? error.message : "Connexion Google impossible.");
  }
}