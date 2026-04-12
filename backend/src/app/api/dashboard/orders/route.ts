import { NextResponse } from "next/server";

import { API_URL, buildApiUrl } from "@/lib/api";
import { getBackendAccessTokenFromCookies } from "@/lib/backend-access-token";
import { buildServerForwardHeaders } from "@/lib/server-forward-headers";
import { getCurrentUser } from "@/lib/user-auth";

async function requireUser() {
  return getCurrentUser().catch(() => null);
}

export async function GET(request: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ message: "Connexion requise." }, { status: 401 });
  }

  if (!API_URL) {
    return NextResponse.json({ message: "Commandes partenaire indisponibles sans backend Laravel." }, { status: 503 });
  }

  if (!(await getBackendAccessTokenFromCookies())) {
    return NextResponse.json({ message: "Session backend expiree. Reconnectez-vous puis reessayez." }, { status: 401 });
  }

  const url = new URL(request.url);
  const page = url.searchParams.get("page")?.trim() || "1";
  const response = await fetch(buildApiUrl("/api/partner/portal/orders", { page }), {
    method: "GET",
    headers: await buildServerForwardHeaders({ accept: "application/json" }),
    cache: "no-store",
  });

  const body = await response.json().catch(() => null);
  return NextResponse.json(body ?? { message: "Impossible de recuperer les commandes partenaire." }, { status: response.status || 502 });
}