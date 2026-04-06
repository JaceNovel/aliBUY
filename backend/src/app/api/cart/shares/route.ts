import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { createSharedCart } from "@/lib/cart-share-store";
import { SITE_NAME, SITE_URL } from "@/lib/site-config";
import { getCurrentUser } from "@/lib/user-auth";

type CartShareRequest = {
  items?: unknown;
  message?: unknown;
};

function buildOrigin(request: Request) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";

  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  try {
    return new URL(request.url).origin;
  } catch {
    return SITE_URL;
  }
}

function sanitizeMessage(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > 0 ? compact.slice(0, 90) : undefined;
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: "Connexion requise." }, { status: 401 });
    }

    const body = await request.json().catch(() => null) as CartShareRequest | null;
    const items = Array.isArray(body?.items) ? body.items : [];

    if (items.length === 0) {
      return NextResponse.json({ message: "Panier vide." }, { status: 400 });
    }

    const sharedCart = await createSharedCart({
      ownerUserId: user.id,
      ownerEmail: user.email,
      ownerDisplayName: user.displayName,
      message: sanitizeMessage(body?.message),
      items,
    });

    const origin = buildOrigin(request);
    const shareUrl = `${origin}/cart/shared/${encodeURIComponent(sharedCart.token)}`;
    const shareText = sharedCart.message
      ? sharedCart.message
      : `${SITE_NAME}: valide ce panier`;
    const copyText = `${shareText} ${shareUrl}`;

    return NextResponse.json({
      id: sharedCart.id ?? randomUUID(),
      shareUrl,
      shareText,
      copyText,
      token: sharedCart.token,
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Partage indisponible." },
      { status: 400 },
    );
  }
}
