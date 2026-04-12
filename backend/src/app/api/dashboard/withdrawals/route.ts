import { NextResponse } from "next/server";

import { API_URL, buildApiUrl } from "@/lib/api";
import { getBackendAccessTokenFromCookies } from "@/lib/backend-access-token";
import { buildServerForwardHeaders } from "@/lib/server-forward-headers";
import { getCurrentUser } from "@/lib/user-auth";

async function requireUser() {
  return getCurrentUser().catch(() => null);
}

async function proxyWithdrawals(request: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ message: "Connexion requise." }, { status: 401 });
  }

  if (!API_URL) {
    return NextResponse.json({ message: "Retraits partenaire indisponibles sans backend Laravel." }, { status: 503 });
  }

  if (!(await getBackendAccessTokenFromCookies())) {
    return NextResponse.json({ message: "Session backend expiree. Reconnectez-vous puis reessayez." }, { status: 401 });
  }

  const response = await fetch(buildApiUrl("/api/partner/portal/withdrawals"), {
    method: request.method,
    headers: await buildServerForwardHeaders({
      accept: request.headers.get("accept")?.trim() || "application/json",
      ...(request.headers.get("content-type") ? { "content-type": request.headers.get("content-type") as string } : {}),
    }),
    body: request.method === "GET" ? undefined : await request.arrayBuffer(),
    cache: "no-store",
  });

  const body = await response.json().catch(() => null);
  return NextResponse.json(body ?? { message: "Impossible de gerer les retraits partenaire." }, { status: response.status || 502 });
}

export async function GET(request: Request) {
  return proxyWithdrawals(request);
}

export async function POST(request: Request) {
  return proxyWithdrawals(request);
}