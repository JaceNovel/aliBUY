import { NextResponse } from "next/server";

import { API_URL, buildApiUrl } from "@/lib/api";
import { buildServerForwardHeaders } from "@/lib/server-forward-headers";
import { getCurrentUser } from "@/lib/user-auth";

export async function POST(request: Request) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) {
    return NextResponse.json({ message: "Connexion requise." }, { status: 401 });
  }

  if (!API_URL) {
    return NextResponse.json({ message: "Mise a jour de photo indisponible sans backend Laravel." }, { status: 503 });
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ message: "Fichier manquant." }, { status: 400 });
  }

  const response = await fetch(buildApiUrl("/api/account/profile-photo"), {
    method: "POST",
    headers: await buildServerForwardHeaders({
      accept: "application/json",
    }),
    body: formData,
    cache: "no-store",
  });

  const body = await response.json().catch(() => null);
  return NextResponse.json(body ?? { message: "Impossible d'envoyer cette photo." }, { status: response.status || 502 });
}