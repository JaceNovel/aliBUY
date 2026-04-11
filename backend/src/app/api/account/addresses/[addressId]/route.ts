import { NextResponse } from "next/server";

import { API_URL, buildApiUrl } from "@/lib/api";
import { buildServerForwardHeaders } from "@/lib/server-forward-headers";
import { getCurrentUser } from "@/lib/user-auth";

async function requireUser() {
  return getCurrentUser().catch(() => null);
}

export async function PUT(request: Request, context: { params: Promise<{ addressId: string }> }) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ message: "Connexion requise." }, { status: 401 });
  }

  if (!API_URL) {
    return NextResponse.json({ message: "Gestion d'adresses indisponible sans backend Laravel." }, { status: 503 });
  }

  const payload = await request.json().catch(() => null);
  const { addressId } = await context.params;
  const response = await fetch(buildApiUrl(`/api/account/addresses/${encodeURIComponent(addressId)}`), {
    method: "PUT",
    headers: await buildServerForwardHeaders({
      accept: "application/json",
      "content-type": "application/json",
    }),
    body: JSON.stringify(payload ?? {}),
    cache: "no-store",
  });

  const body = await response.json().catch(() => null);
  return NextResponse.json(body ?? { message: "Impossible de mettre a jour l'adresse." }, { status: response.status || 502 });
}

export async function PATCH(request: Request, context: { params: Promise<{ addressId: string }> }) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ message: "Connexion requise." }, { status: 401 });
  }

  if (!API_URL) {
    return NextResponse.json({ message: "Gestion d'adresses indisponible sans backend Laravel." }, { status: 503 });
  }

  const payload = await request.json().catch(() => null);
  const { addressId } = await context.params;
  const response = await fetch(buildApiUrl(`/api/account/addresses/${encodeURIComponent(addressId)}`), {
    method: "PATCH",
    headers: await buildServerForwardHeaders({
      accept: "application/json",
      "content-type": "application/json",
    }),
    body: JSON.stringify(payload ?? {}),
    cache: "no-store",
  });

  const body = await response.json().catch(() => null);
  return NextResponse.json(body ?? { message: "Impossible de changer l'adresse par defaut." }, { status: response.status || 502 });
}

export async function DELETE(_request: Request, context: { params: Promise<{ addressId: string }> }) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ message: "Connexion requise." }, { status: 401 });
  }

  if (!API_URL) {
    return NextResponse.json({ message: "Gestion d'adresses indisponible sans backend Laravel." }, { status: 503 });
  }

  const { addressId } = await context.params;
  const response = await fetch(buildApiUrl(`/api/account/addresses/${encodeURIComponent(addressId)}`), {
    method: "DELETE",
    headers: await buildServerForwardHeaders({ accept: "application/json" }),
    cache: "no-store",
  });

  const body = await response.json().catch(() => null);
  return NextResponse.json(body ?? { message: "Impossible de supprimer l'adresse." }, { status: response.status || 502 });
}