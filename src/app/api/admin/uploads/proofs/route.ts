import { randomUUID } from "node:crypto";

import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

const MAX_PROOF_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_PROOF_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

function sanitizeFileName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "") || "proof";
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ message: "Aucun fichier de preuve n'a ete envoye." }, { status: 400 });
  }

  if (file.size <= 0) {
    return NextResponse.json({ message: "Le fichier de preuve est vide." }, { status: 400 });
  }

  if (file.size > MAX_PROOF_SIZE_BYTES) {
    return NextResponse.json({ message: "Le fichier de preuve depasse 10 Mo." }, { status: 400 });
  }

  if (!ALLOWED_PROOF_TYPES.has(file.type)) {
    return NextResponse.json({ message: "Formats acceptes: JPG, PNG, WEBP, GIF ou PDF." }, { status: 400 });
  }

  const extension = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : "";
  const pathname = `delivery-proofs/${new Date().toISOString().slice(0, 10)}/${randomUUID()}-${sanitizeFileName(file.name.replace(/\.[^.]+$/, ""))}${extension}`;
  const blob = await put(pathname, file, {
    access: "public",
    addRandomSuffix: false,
    contentType: file.type,
  });

  return NextResponse.json({
    url: blob.url,
    pathname: blob.pathname,
    contentType: file.type,
    size: file.size,
    fileName: file.name,
  });
}