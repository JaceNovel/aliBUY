import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { API_URL } from "@/lib/api";
import { getAuthorizedAdminAccessByEmail, validateAdminCredentials } from "@/lib/admin-auth";
import { getForceLoggedOutCookieConfig } from "@/lib/auth-session-flags";
import { getBackendAccessTokenCookieConfig } from "@/lib/backend-access-token";
import { getBackendBearerToken, mapBackendUserToSessionIdentity, postBackendAuth } from "@/lib/backend-auth-client";
import { createUserSessionToken } from "@/lib/user-session";
import { getUserSessionCookieConfig, validateUserCredentials } from "@/lib/user-auth";

async function createLocalAdminSession(email: string, backendBearerToken?: string) {
  const access = await getAuthorizedAdminAccessByEmail(email);
  if (!access) {
    return NextResponse.json({ message: "Accès admin non autorisé pour ce compte." }, { status: 403 });
  }

  const token = await createUserSessionToken({
    id: `admin:${email}`,
    email,
    displayName: access.isSuperAdmin ? "Super Admin" : `Admin ${access.role}`,
  });

  const cookieStore = await cookies();
  cookieStore.set({
    ...getForceLoggedOutCookieConfig(),
    value: "",
    maxAge: 0,
  });
  cookieStore.set({
    ...getUserSessionCookieConfig(),
    value: token,
  });

  if (backendBearerToken) {
    cookieStore.set({
      ...getBackendAccessTokenCookieConfig(),
      value: backendBearerToken,
    });
  } else {
    cookieStore.set({
      ...getBackendAccessTokenCookieConfig(),
      value: "",
      maxAge: 0,
    });
  }

  return NextResponse.json({ ok: true, isAdmin: true, role: access.role, usedLocalAdminFallback: true });
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null) as { email?: string; password?: string } | null;
  const email = payload?.email?.trim().toLowerCase() || "";
  const password = payload?.password || "";

  if (!email || !password) {
    return NextResponse.json({ message: "Adresse e-mail et mot de passe admin requis." }, { status: 400 });
  }

  if (API_URL) {
    const backendResult = await postBackendAuth(request, "/api/auth/admin-login", { email, password }, "ouvrir la session admin");
    if (!backendResult.ok) {
      const adminAccess = await getAuthorizedAdminAccessByEmail(email);
      if (adminAccess) {
        const backendUserResult = await postBackendAuth(request, "/api/auth/login", { email, password }, "ouvrir une session");
        if (backendUserResult.ok) {
          return createLocalAdminSession(email, getBackendBearerToken(backendUserResult.body));
        }

        const localUser = await validateUserCredentials(email, password).catch(() => null);
        if (localUser) {
          return createLocalAdminSession(email);
        }
      }

      const isLocalAdmin = await validateAdminCredentials(email, password).catch(() => false);
      if (isLocalAdmin) {
        return createLocalAdminSession(email);
      }

      return backendResult.response;
    }

    const backendIdentity = mapBackendUserToSessionIdentity(backendResult.body.user!);
    const sessionToken = await createUserSessionToken({
      id: backendIdentity.id,
      email: backendIdentity.email,
      displayName: backendIdentity.displayName,
    });
    const backendBearerToken = getBackendBearerToken(backendResult.body);

    const cookieStore = await cookies();
    cookieStore.set({
      ...getForceLoggedOutCookieConfig(),
      value: "",
      maxAge: 0,
    });
    cookieStore.set({
      ...getUserSessionCookieConfig(),
      value: sessionToken,
    });
    if (backendBearerToken) {
      cookieStore.set({
        ...getBackendAccessTokenCookieConfig(),
        value: backendBearerToken,
      });
    }

    return NextResponse.json({
      ok: true,
      isAdmin: true,
      role: String(backendResult.body.user?.role || "admin"),
    });
  }

  const isValid = await validateAdminCredentials(email, password).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Configuration admin invalide.";
    return message;
  });

  if (typeof isValid === "string") {
    return NextResponse.json({ message: isValid }, { status: 503 });
  }

  if (!isValid) {
    return NextResponse.json({ message: "Identifiants invalides." }, { status: 401 });
  }

  const localUser = await validateUserCredentials(email, password).catch(() => null);
  if (localUser) {
    return createLocalAdminSession(email);
  }

  return createLocalAdminSession(email);
}