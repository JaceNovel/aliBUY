import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { mapBackendUserToSessionIdentity, postBackendAuth } from "@/lib/backend-auth-client";
import { hasConfiguredDatabaseUrl } from "@/lib/prisma";
import { createUserSessionToken } from "@/lib/user-session";
import { getUserSessionCookieConfig, registerUser, createAuthenticatedUserSession } from "@/lib/user-auth";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null) as { email?: string; password?: string; displayName?: string } | null;
  const email = payload?.email?.trim().toLowerCase() || "";
  const password = payload?.password || "";
  const displayName = payload?.displayName?.trim() || undefined;

  if (!email || !password) {
    return NextResponse.json({ message: "Adresse e-mail et mot de passe requis." }, { status: 400 });
  }

  if (!hasConfiguredDatabaseUrl()) {
    const backendResult = await postBackendAuth(request, "/api/auth/register", {
      name: displayName || email.split("@")[0] || "Client AfriPay",
      email,
      password,
      password_confirmation: password,
    }, "créer le compte");

    if (!backendResult.ok) {
      return backendResult.response;
    }

    const backendIdentity = mapBackendUserToSessionIdentity(backendResult.body.user!);
    const backendToken = await createUserSessionToken(backendIdentity);
    const cookieStore = await cookies();
    cookieStore.set({
      ...getUserSessionCookieConfig(),
      value: backendToken,
    });

    return NextResponse.json({ ok: true, user: backendIdentity });
  }

  try {
    const user = await registerUser({ email, password, displayName });
    const token = await createAuthenticatedUserSession(user);

    const cookieStore = await cookies();
    cookieStore.set({
      ...getUserSessionCookieConfig(),
      value: token,
    });

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
      },
    });
  } catch (error) {
    return NextResponse.json({
      message: error instanceof Error ? error.message : "Impossible de créer le compte.",
    }, { status: 400 });
  }
}