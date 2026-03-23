import { NextResponse } from "next/server";

import { toggleUserFavorite } from "@/lib/customer-data-store";
import { getCurrentUser } from "@/lib/user-auth";

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

  const result = await toggleUserFavorite({ userId: user.id, userEmail: user.email, productSlug });
  return NextResponse.json(result);
}