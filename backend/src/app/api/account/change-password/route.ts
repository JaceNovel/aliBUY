import { NextResponse } from "next/server";

import { API_URL, buildApiUrl } from "@/lib/api";
import { getBackendAccessTokenFromCookies } from "@/lib/backend-access-token";
import { buildServerForwardHeaders } from "@/lib/server-forward-headers";
import { getCurrentUser } from "@/lib/user-auth";

export async function POST(request: Request) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) {
    return NextResponse.json({ message: "Connexion requise." }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  if (!API_URL) {
    return NextResponse.json({ message: "Changement de mot de passe indisponible sans backend Laravel." }, { status: 503 });
  }

  if (!(await getBackendAccessTokenFromCookies())) {
    return NextResponse.json({ message: "Session backend expiree. Reconnectez-vous puis reessayez." }, { status: 401 });
  }

  const response = await fetch(buildApiUrl("/api/account/change-password"), {
    method: "POST",
    headers: await buildServerForwardHeaders({
      accept: "application/json",
      "content-type": "application/json",
    }),
    body: JSON.stringify(payload ?? {}),
    cache: "no-store",
  });

  const body = await response.json().catch(() => null);
  return NextResponse.json(body ?? { message: "Impossible de modifier le mot de passe." }, { status: response.status || 502 });
}