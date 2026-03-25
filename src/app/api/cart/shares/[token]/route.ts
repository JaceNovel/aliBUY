import { NextResponse } from "next/server";

import { getSharedCartByToken } from "@/lib/cart-share-store";

export async function GET(_: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const sharedCart = await getSharedCartByToken(token);
  if (!sharedCart) {
    return NextResponse.json({ message: "Panier partagé introuvable." }, { status: 404 });
  }

  return NextResponse.json({
    id: sharedCart.id,
    token: sharedCart.token,
    ownerDisplayName: sharedCart.ownerDisplayName,
    message: sharedCart.message,
    itemCount: sharedCart.items.length,
    status: sharedCart.status,
    items: sharedCart.items,
  });
}