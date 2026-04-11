import { NextResponse } from "next/server";

import { API_URL, buildApiUrl } from "@/lib/api";
import { getBackendAccessTokenFromCookies } from "@/lib/backend-access-token";
import { buildServerForwardHeaders } from "@/lib/server-forward-headers";
import { getCurrentUser } from "@/lib/user-auth";

async function requireUser() {
  return getCurrentUser().catch(() => null);
}

export async function GET() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ message: "Connexion requise." }, { status: 401 });
  }

  if (!API_URL) {
    return NextResponse.json({ addresses: [] });
  }

  if (!(await getBackendAccessTokenFromCookies())) {
    return NextResponse.json({ addresses: [] });
  }

  const response = await fetch(buildApiUrl("/api/account/addresses"), {
    method: "GET",
    headers: await buildServerForwardHeaders({ accept: "application/json" }),
    cache: "no-store",
  });

  const body = await response.json().catch(() => null);
  return NextResponse.json(body ?? { message: "Impossible de recuperer les adresses." }, { status: response.status || 502 });
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ message: "Connexion requise." }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  if (!API_URL) {
    return NextResponse.json({ message: "Gestion d'adresses indisponible sans backend Laravel." }, { status: 503 });
  }

  if (!(await getBackendAccessTokenFromCookies())) {
    return NextResponse.json({ message: "Session backend expiree. Reconnectez-vous puis reessayez." }, { status: 401 });
  }

  const response = await fetch(buildApiUrl("/api/account/addresses"), {
    method: "POST",
    headers: await buildServerForwardHeaders({
      accept: "application/json",
      "content-type": "application/json",
    }),
    body: JSON.stringify(payload ?? {}),
    cache: "no-store",
  });

  const body = await response.json().catch(() => null);
  return NextResponse.json(body ?? { message: "Impossible d'enregistrer l'adresse." }, { status: response.status || 502 });
}