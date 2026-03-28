import { NextResponse } from "next/server";

import { isUserFavoriteProduct, toggleUserFavorite } from "@/lib/customer-data-store";
import { getCurrentUser } from "@/lib/user-auth";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  const { searchParams } = new URL(request.url);
  const productSlug = searchParams.get("productSlug")?.trim() ?? "";

  if (!productSlug) {
    return NextResponse.json({ message: "Produit invalide." }, { status: 400 });
  }

  if (!user) {
    return NextResponse.json({ authenticated: false, isFavorite: false });
  }

  const isFavorite = await isUserFavoriteProduct(user.id, productSlug);
  return NextResponse.json({ authenticated: true, isFavorite });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: "Connexion requise." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const productSlug = typeof body?.productSlug === "string" ? body.productSlug.trim() : "";
  if (!productSlug) {
    return NextResponse.json({ message: "Produit invalide." }, { status: 400 });
  }

  try {
    const result = await toggleUserFavorite({ userId: user.id, userEmail: user.email, productSlug });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Impossible de mettre a jour le favori.";
    const status = message.includes("n'est pas configure") ? 503 : 400;
    return NextResponse.json({ message }, { status });
  }
}