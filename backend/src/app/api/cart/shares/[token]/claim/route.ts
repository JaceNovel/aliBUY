import { NextResponse } from "next/server";

import { getSharedCartByToken, markSharedCartClaimed } from "@/lib/cart-share-store";
import { getCurrentUser } from "@/lib/user-auth";

export async function POST(_: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: "Connexion requise." }, { status: 401 });
    }

    const { token } = await context.params;
    const sharedCart = await getSharedCartByToken(token);
    if (!sharedCart) {
      return NextResponse.json({ message: "Lien panier introuvable." }, { status: 404 });
    }

    await markSharedCartClaimed({
      token,
      claimerUserId: user.id,
      claimerDisplayName: user.displayName,
    });

    return NextResponse.json({
      ok: true,
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
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Import du panier impossible." },
      { status: 400 },
    );
  }
}
