import { NextResponse } from "next/server";

import { API_URL, buildApiUrl } from "@/lib/api";
import { getBackendAccessTokenFromCookies } from "@/lib/backend-access-token";
import { buildServerForwardHeaders } from "@/lib/server-forward-headers";
import { getCurrentUser } from "@/lib/user-auth";

async function requireUser() {
  return getCurrentUser().catch(() => null);
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const user = await requireUser();
  if (!user) {
    if (!API_URL) {
      return NextResponse.json({ message: "Verification de paiement indisponible sans backend Laravel." }, { status: 503 });
    }

    const response = await fetch(buildApiUrl("/api/free-deals/verify-payment"), {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify(payload ?? {}),
      cache: "no-store",
    });

    const body = await response.json().catch(() => null);
    return NextResponse.json(body ?? { message: "Impossible de verifier le paiement." }, { status: response.status || 502 });
  }

  if (!API_URL) {
    return NextResponse.json({ message: "Verification de paiement indisponible sans backend Laravel." }, { status: 503 });
  }

  if (!(await getBackendAccessTokenFromCookies())) {
    return NextResponse.json({ message: "Session backend expiree. Reconnectez-vous puis reessayez." }, { status: 401 });
  }

  const response = await fetch(buildApiUrl("/api/payments/verify"), {
    method: "POST",
    headers: await buildServerForwardHeaders({
      accept: "application/json",
      "content-type": "application/json",
    }),
    body: JSON.stringify(payload ?? {}),
    cache: "no-store",
  });

  const body = await response.json().catch(() => null);
  return NextResponse.json(body ?? { message: "Impossible de verifier le paiement." }, { status: response.status || 502 });
}
