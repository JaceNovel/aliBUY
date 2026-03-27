import { NextResponse } from "next/server";

import { createSharedCart } from "@/lib/cart-share-store";
import { getCurrentUser } from "@/lib/user-auth";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: "Connexion requise." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const items = Array.isArray(body?.items) ? body.items : [];
  const message = typeof body?.message === "string" ? body.message : undefined;
  if (items.length === 0) {
    return NextResponse.json({ message: "Le panier partagé est vide." }, { status: 400 });
  }

  const sharedCart = await createSharedCart({
    ownerUserId: user.id,
    ownerEmail: user.email,
    ownerDisplayName: user.displayName,
    message,
    items,
  });
  const origin = new URL(request.url).origin;
  const shareUrl = `${origin}/cart/shared/${encodeURIComponent(sharedCart.token)}`;
  const shareText = [
    `${user.displayName} vous partage un panier AfriPay.`,
    "Ouvrez ce lien pour importer les articles dans votre compte, finaliser le checkout puis payer.",
    "Le suivi restera sur le compte qui paie, avec mention claire du créateur du panier.",
    shareUrl,
  ].join(" ");

  return NextResponse.json({
    sharedCart,
    shareUrl,
    shareText,
  });
}