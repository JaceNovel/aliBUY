import { NextResponse } from "next/server";

import { API_URL, buildApiUrl } from "@/lib/api";
import { getAccountSettings, updateAccountSettings } from "@/lib/account-settings-store";
import { buildServerForwardHeaders } from "@/lib/server-forward-headers";
import { getCurrentUser } from "@/lib/user-auth";

async function requireCurrentUser() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) {
    return null;
  }

  return user;
}

export async function GET() {
  const user = await requireCurrentUser();
  if (!user) {
    return NextResponse.json({ message: "Connexion requise." }, { status: 401 });
  }

  if (!API_URL) {
    const settings = await getAccountSettings(user.id);
    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        firstName: user.firstName,
        createdAt: user.createdAt,
      },
      settings,
    });
  }

  const response = await fetch(buildApiUrl("/api/account/settings"), {
    method: "GET",
    headers: await buildServerForwardHeaders({
      accept: "application/json",
    }),
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null);
  return NextResponse.json(payload ?? { message: "Impossible de recuperer les reglages du compte." }, { status: response.status || 502 });
}

export async function PATCH(request: Request) {
  const user = await requireCurrentUser();
  if (!user) {
    return NextResponse.json({ message: "Connexion requise." }, { status: 401 });
  }

  const input = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return NextResponse.json({ message: "Payload invalide." }, { status: 400 });
  }

  if (!API_URL) {
    const settings = await updateAccountSettings(user.id, input);
    return NextResponse.json({ ok: true, settings });
  }

  const response = await fetch(buildApiUrl("/api/account/settings"), {
    method: "PATCH",
    headers: await buildServerForwardHeaders({
      accept: "application/json",
      "content-type": "application/json",
    }),
    body: JSON.stringify(input),
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
  return NextResponse.json(payload ?? { message: "Impossible d'enregistrer ces informations." }, { status: response.status || 502 });
}