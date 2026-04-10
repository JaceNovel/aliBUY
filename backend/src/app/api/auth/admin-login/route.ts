import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getAuthorizedAdminAccessByEmail, validateAdminCredentials } from "@/lib/admin-auth";
import { createUserSessionToken } from "@/lib/user-session";
import { getUserSessionCookieConfig } from "@/lib/user-auth";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null) as { email?: string; password?: string } | null;
  const email = payload?.email?.trim().toLowerCase() || "";
  const password = payload?.password || "";

  if (!email || !password) {
    return NextResponse.json({ message: "Adresse e-mail et mot de passe admin requis." }, { status: 400 });
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
    ...getUserSessionCookieConfig(),
    value: token,
  });

  return NextResponse.json({ ok: true, isAdmin: true, role: access.role });
}