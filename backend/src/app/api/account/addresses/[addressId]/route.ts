import { NextResponse } from "next/server";

import { API_URL, buildApiUrl } from "@/lib/api";
import { getBackendAccessTokenFromCookies } from "@/lib/backend-access-token";
import { deleteUserAddress, setUserDefaultAddress, updateUserAddress } from "@/lib/customer-data-store";
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

  const payload = await request.json().catch(() => null);
  const { addressId } = await context.params;
  const backendAccessToken = await getBackendAccessTokenFromCookies();
  if (user.authProvider === "clerk" || !API_URL || !backendAccessToken) {
    const address = await updateUserAddress(user.id, addressId, payload ?? {});
    return NextResponse.json({ address });
  }

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

  const payload = await request.json().catch(() => null);
  const { addressId } = await context.params;
  const backendAccessToken = await getBackendAccessTokenFromCookies();
  if (user.authProvider === "clerk" || !API_URL || !backendAccessToken) {
    if (payload && typeof payload === "object" && "isDefault" in payload) {
      const address = await setUserDefaultAddress(user.id, addressId);
      return NextResponse.json({ address });
    }

    const address = await setUserDefaultAddress(user.id, addressId);
    return NextResponse.json({ address });
  }

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

  const { addressId } = await context.params;
  const backendAccessToken = await getBackendAccessTokenFromCookies();
  if (user.authProvider === "clerk" || !API_URL || !backendAccessToken) {
    await deleteUserAddress(user.id, addressId);
    return NextResponse.json({ ok: true });
  }

  const response = await fetch(buildApiUrl(`/api/account/addresses/${encodeURIComponent(addressId)}`), {
    method: "DELETE",
    headers: await buildServerForwardHeaders({ accept: "application/json" }),
    cache: "no-store",
  });

  const body = await response.json().catch(() => null);
  return NextResponse.json(body ?? { message: "Impossible de supprimer l'adresse." }, { status: response.status || 502 });
}
