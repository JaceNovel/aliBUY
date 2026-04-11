import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { API_URL } from "@/lib/api";
import { getAuthorizedAdminAccessByEmail, validateAdminCredentials } from "@/lib/admin-auth";
import { getBackendAccessTokenCookieConfig } from "@/lib/backend-access-token";
import { getBackendBearerToken, mapBackendUserToSessionIdentity, postBackendAuth } from "@/lib/backend-auth-client";
import { hasConfiguredDatabaseUrl } from "@/lib/prisma";
import { createUserSessionToken } from "@/lib/user-session";
import { createAuthenticatedUserSession, validateUserCredentials } from "@/lib/user-auth";
import { getUserSessionCookieConfig } from "@/lib/user-auth";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null) as { email?: string; password?: string } | null;
  const email = payload?.email?.trim().toLowerCase() || "";
  const password = payload?.password || "";

  if (!email || !password) {
    return NextResponse.json({ message: "Adresse e-mail et mot de passe requis." }, { status: 400 });
  }

  const user = hasConfiguredDatabaseUrl()
    ? await validateUserCredentials(email, password).catch(() => null)
    : null;
  if (!user) {
    const isAdmin = await validateAdminCredentials(email, password).catch(() => false);
    if (!isAdmin) {
      const backendResult = await postBackendAuth(request, "/api/auth/login", { email, password }, "ouvrir une session");
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
      const backendBearerToken = getBackendBearerToken(backendResult.body);
      if (backendBearerToken) {
        cookieStore.set({
          ...getBackendAccessTokenCookieConfig(),
          value: backendBearerToken,
        });
      }

      return NextResponse.json({
        ok: true,
        user: backendIdentity,
        isAdmin: ["admin", "super_admin"].includes(String(backendResult.body.user?.role || "")),
      });
    }

    const access = await getAuthorizedAdminAccessByEmail(email);
    if (!access) {
      return NextResponse.json({ message: "Accès admin non autorisé pour ce compte." }, { status: 403 });
    }

    if (API_URL) {
      const backendAdminResult = await postBackendAuth(request, "/api/auth/admin-login", { email, password }, "ouvrir une session admin");
      if (!backendAdminResult.ok) {
        return backendAdminResult.response;
      }

      const backendIdentity = mapBackendUserToSessionIdentity(backendAdminResult.body.user!);
      const backendSessionToken = await createUserSessionToken(backendIdentity);
      const cookieStore = await cookies();
      cookieStore.set({
        ...getUserSessionCookieConfig(),
        value: backendSessionToken,
      });

      const backendBearerToken = getBackendBearerToken(backendAdminResult.body);
      if (backendBearerToken) {
        cookieStore.set({
          ...getBackendAccessTokenCookieConfig(),
          value: backendBearerToken,
        });
      }

      return NextResponse.json({ ok: true, isAdmin: true, role: String(backendAdminResult.body.user?.role || access.role) });
    }

    const adminToken = await createUserSessionToken({
      id: `admin:${email}`,
      email,
      displayName: access.isSuperAdmin ? "Super Admin" : `Admin ${access.role}`,
    });

    const cookieStore = await cookies();
    cookieStore.set({
      ...getUserSessionCookieConfig(),
      value: adminToken,
    });

    return NextResponse.json({ ok: true, isAdmin: true, role: access.role });
  }

  const token = await createAuthenticatedUserSession(user);
  const cookieStore = await cookies();
  let backendBearerToken = "";

  if (API_URL) {
    const backendResult = await postBackendAuth(request, "/api/auth/login", { email, password }, "ouvrir une session");
    if (backendResult.ok) {
      backendBearerToken = getBackendBearerToken(backendResult.body);
    }
  }

  cookieStore.set({
    ...getUserSessionCookieConfig(),
    value: token,
  });

  if (backendBearerToken) {
    cookieStore.set({
      ...getBackendAccessTokenCookieConfig(),
      value: backendBearerToken,
    });
  }

  return NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
    },
  });
}