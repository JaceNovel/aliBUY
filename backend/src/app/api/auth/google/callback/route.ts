import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { exchangeGoogleOauthCode, getGoogleOauthStateCookieConfig, parseGoogleOauthState } from "@/lib/google-oauth";
import { createAuthenticatedUserSession, getCurrentUser, getUserSessionCookieConfig, registerUser } from "@/lib/user-auth";

function redirectWithError(requestUrl: URL, mode: "login" | "register", nextPath: string, message: string) {
  const target = new URL(mode === "register" ? "/register" : "/login", requestUrl.origin);
  target.searchParams.set("next", nextPath);
  target.searchParams.set("oauth_error", message);
  return NextResponse.redirect(target);
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
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

    return NextResponse.redirect(new URL(nextPath, requestUrl.origin));
  } catch (error) {
    return redirectWithError(requestUrl, mode, nextPath, error instanceof Error ? error.message : "Connexion Google impossible.");
  }
}