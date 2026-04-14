import { NextResponse } from "next/server";

import { API_URL, buildApiUrl } from "@/lib/api";
import { getBackendAccessTokenFromCookies } from "@/lib/backend-access-token";
import { createUserAddress, getUserAddresses } from "@/lib/customer-data-store";
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

  const backendAccessToken = await getBackendAccessTokenFromCookies();
  if (user.authProvider === "clerk" || !API_URL || !backendAccessToken) {
    const addresses = await getUserAddresses(user.id);
    return NextResponse.json({ addresses });
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
  const backendAccessToken = await getBackendAccessTokenFromCookies();
  if (user.authProvider === "clerk" || !API_URL || !backendAccessToken) {
    const address = await createUserAddress(user.id, payload ?? {});
    return NextResponse.json({ address }, { status: 201 });
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
