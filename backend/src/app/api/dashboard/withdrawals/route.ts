import { NextResponse } from "next/server";

import { API_URL } from "@/lib/api";
import { fetchPartnerPortalResponse, getCurrentPartnerPortalIdentity } from "@/lib/partner-portal";

async function requireUser() {
  return getCurrentPartnerPortalIdentity().catch(() => null);
}

async function proxyWithdrawals(request: Request) {
  const email = await requireUser();
  if (!email) {
    return NextResponse.json({ message: "Connexion requise." }, { status: 401 });
  }

  if (!API_URL) {
    return NextResponse.json({ message: "Retraits partenaire indisponibles sans backend Laravel." }, { status: 503 });
  }

  const response = await fetchPartnerPortalResponse(
    "/api/partner/portal/withdrawals",
    email,
    undefined,
    {
      method: request.method,
      headers: {
        accept: request.headers.get("accept")?.trim() || "application/json",
        ...(request.headers.get("content-type") ? { "content-type": request.headers.get("content-type") as string } : {}),
      },
      body: request.method === "GET" ? undefined : await request.arrayBuffer(),
    },
  );

  const body = await response.json().catch(() => null);
  return NextResponse.json(body ?? { message: "Impossible de gerer les retraits partenaire." }, { status: response.status || 502 });
}

export async function GET(request: Request) {
  return proxyWithdrawals(request);
}

export async function POST(request: Request) {
  return proxyWithdrawals(request);
}