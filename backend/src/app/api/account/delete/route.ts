import { NextResponse } from "next/server";

import { API_URL, buildApiUrl } from "@/lib/api";
import { buildServerForwardHeaders } from "@/lib/server-forward-headers";
import { getCurrentUser } from "@/lib/user-auth";

export async function POST(request: Request) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) {
    return NextResponse.json({ message: "Connexion requise." }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  if (!API_URL) {
    return NextResponse.json({ message: "Suppression de compte indisponible sans backend Laravel." }, { status: 503 });
  }

  const response = await fetch(buildApiUrl("/api/account/delete"), {
    method: "POST",
    headers: await buildServerForwardHeaders({
      accept: "application/json",
      "content-type": "application/json",
    }),
    body: JSON.stringify(payload ?? {}),
    cache: "no-store",
  });

  const body = await response.json().catch(() => null);
  return NextResponse.json(body ?? { message: "Impossible de supprimer le compte." }, { status: response.status || 502 });
}