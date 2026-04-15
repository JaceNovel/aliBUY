import { NextResponse } from "next/server";

import { API_URL } from "@/lib/api";
import { fetchPartnerPortalResponse, getCurrentPartnerPortalIdentity } from "@/lib/partner-portal";

async function requireUser() {
  return getCurrentPartnerPortalIdentity().catch(() => null);
}

export async function GET() {
  const email = await requireUser();
  if (!email) {
    return NextResponse.json({ message: "Connexion requise." }, { status: 401 });
  }

  if (!API_URL) {
    return NextResponse.json({ message: "Wallet partenaire indisponible sans backend Laravel." }, { status: 503 });
  }

  const response = await fetchPartnerPortalResponse("/api/partner/portal/wallet", email);

  const body = await response.json().catch(() => null);
  return NextResponse.json(body ?? { message: "Impossible de recuperer le wallet partenaire." }, { status: response.status || 502 });
}