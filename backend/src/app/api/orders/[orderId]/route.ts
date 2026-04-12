import { NextResponse } from "next/server";

import { API_URL, buildApiUrl } from "@/lib/api";
import { getBackendAccessTokenFromCookies } from "@/lib/backend-access-token";
import { buildServerForwardHeaders } from "@/lib/server-forward-headers";
import { getCurrentUser } from "@/lib/user-auth";

type RouteContext = {
  params: Promise<{ orderId: string }>;
};

async function requireUser() {
  return getCurrentUser().catch(() => null);
}

export async function GET(_request: Request, context: RouteContext) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ message: "Connexion requise." }, { status: 401 });
  }

  if (!API_URL) {
    return NextResponse.json({ message: "Lecture de commande indisponible sans backend Laravel." }, { status: 503 });
  }

  if (!(await getBackendAccessTokenFromCookies())) {
    return NextResponse.json({ message: "Session backend expiree. Reconnectez-vous puis reessayez." }, { status: 401 });
  }

  const { orderId } = await context.params;
  const response = await fetch(buildApiUrl(`/api/orders/${encodeURIComponent(orderId)}`), {
    method: "GET",
    headers: await buildServerForwardHeaders({ accept: "application/json" }),
    cache: "no-store",
  });

  const body = await response.json().catch(() => null);
  return NextResponse.json(body ?? { message: "Impossible de recuperer la commande." }, { status: response.status || 502 });
}