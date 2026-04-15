import { NextResponse } from "next/server";

import { API_URL } from "@/lib/api";
import { fetchPartnerPortalResponse, getCurrentPartnerPortalIdentity } from "@/lib/partner-portal";

async function requireUser() {
  return getCurrentPartnerPortalIdentity().catch(() => null);
}

export async function GET(request: Request) {
  const email = await requireUser();
  if (!email) {
    return NextResponse.json({ message: "Connexion requise." }, { status: 401 });
  }

  if (!API_URL) {
    return NextResponse.json({ message: "Commandes partenaire indisponibles sans backend Laravel." }, { status: 503 });
  }

  const url = new URL(request.url);
  const page = url.searchParams.get("page")?.trim() || "1";
  const response = await fetchPartnerPortalResponse("/api/partner/portal/orders", email, { page });

  const body = await response.json().catch(() => null);
  return NextResponse.json(body ?? { message: "Impossible de recuperer les commandes partenaire." }, { status: response.status || 502 });
}