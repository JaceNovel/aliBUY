import { NextResponse } from "next/server";

import { getSharedCartByToken, markSharedCartClaimed } from "@/lib/cart-share-store";
import { getCurrentUser } from "@/lib/user-auth";

export async function POST(_: Request, context: { params: Promise<{ token: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: "Connexion requise." }, { status: 401 });
  }

  const { token } = await context.params;
  const sharedCart = await getSharedCartByToken(token);
  if (!sharedCart) {
    return NextResponse.json({ message: "Panier partagé introuvable." }, { status: 404 });
  }

  const nextSharedCart = await markSharedCartClaimed({
    token,
    claimerUserId: user.id,
    claimerDisplayName: user.displayName,
  });

  return NextResponse.json({
    sharedCart: nextSharedCart,
    cartItems: sharedCart.items,
    sharedContext: {
      token: sharedCart.token,
      ownerUserId: sharedCart.ownerUserId,
      ownerEmail: sharedCart.ownerEmail,
      ownerDisplayName: sharedCart.ownerDisplayName,
      message: sharedCart.message,
      importedAt: new Date().toISOString(),
    },
  });
}