import { NextResponse } from "next/server";

import { markSharedCartClaimed } from "@/lib/cart-share-store";
import { getCurrentUser } from "@/lib/user-auth";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) {
    return NextResponse.json({ message: "Connexion requise." }, { status: 401 });
  }

  const { token } = await params;
  if (!token.trim()) {
    return NextResponse.json({ message: "Token de partage invalide." }, { status: 400 });
  }

  const sharedCart = await markSharedCartClaimed({
    token,
    claimerUserId: user.id,
    claimerDisplayName: user.displayName,
  });

  if (!sharedCart) {
    return NextResponse.json({ message: "Panier partage introuvable." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    status: sharedCart.status,
    claimCount: sharedCart.claimCount,
    lastClaimedAt: sharedCart.lastClaimedAt,
  });
}