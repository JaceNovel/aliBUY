import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { API_URL, buildApiUrl } from "@/lib/api";
import { buildAuthenticatedProxyHeaders } from "@/lib/proxy-auth";
import { updateAccountSettings } from "@/lib/account-settings-store";
import { getCurrentUser } from "@/lib/user-auth";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "profile-images");
const ALLOWED_TYPES = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
]);

async function persistProfilePhotoToBackend(request: Request, profilePhotoUrl: string) {
  if (!API_URL) {
    return false;
  }

  const upstreamUrl = buildApiUrl("/api/account/settings");
  const currentUrl = new URL(request.url);
  const upstreamHost = new URL(upstreamUrl).host;
  if (!upstreamHost || upstreamHost === currentUrl.host) {
    return false;
  }

  const upstreamResponse = await fetch(upstreamUrl, {
    method: "PATCH",
    headers: await buildAuthenticatedProxyHeaders(request, {
      "content-type": "application/json",
      accept: "application/json",
    }),
    body: JSON.stringify({ profilePhotoUrl }),
    cache: "no-store",
  }).catch(() => null);

  if (!upstreamResponse) {
    throw new Error("Impossible de joindre le backend pour enregistrer la photo de profil.");
  }

  if (!upstreamResponse.ok) {
    const payload = await upstreamResponse.text().catch(() => "");
    throw new Error(payload || "Impossible d'enregistrer la photo de profil.");
  }

  return true;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: "Authentification requise." }, { status: 401 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ message: "Fichier manquant." }, { status: 400 });
  }

  const extension = ALLOWED_TYPES.get(file.type);
  if (!extension) {
    return NextResponse.json({ message: "Format non pris en charge. Utilisez JPG, PNG ou WEBP." }, { status: 400 });
  }

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ message: "Le fichier dépasse 5 Mo." }, { status: 400 });
  }

  await mkdir(UPLOAD_DIR, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  const filename = `${user.id}-${randomUUID()}${extension}`;
  const fullPath = path.join(UPLOAD_DIR, filename);
  await writeFile(fullPath, buffer);

  const profilePhotoUrl = `/uploads/profile-images/${filename}`;
  const persistedRemotely = await persistProfilePhotoToBackend(request, profilePhotoUrl);
  if (!persistedRemotely) {
    await updateAccountSettings(user.id, { profilePhotoUrl });
  }

  return NextResponse.json({ profilePhotoUrl });
}