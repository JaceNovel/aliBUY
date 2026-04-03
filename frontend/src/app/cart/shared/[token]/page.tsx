import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SharedCartClaimClient } from "@/app/cart/shared/[token]/shared-cart-claim-client";
import { InternalPageShell } from "@/components/internal-page-shell";
import { getSharedCartByToken } from "@/lib/cart-share-store";
import { getPricingContext } from "@/lib/pricing";
import { CART_SHARE_IMAGE_PATH, SITE_NAME, SITE_URL } from "@/lib/site-config";
import { getCurrentUser } from "@/lib/user-auth";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const sharedCart = await getSharedCartByToken(token);

  if (!sharedCart) {
    return {
      title: `Panier partage | ${SITE_NAME}`,
    };
  }

  const title = `${sharedCart.ownerDisplayName} a partage un panier`;
  const description = sharedCart.message?.trim() || `${sharedCart.items.length} article${sharedCart.items.length > 1 ? "s" : ""} partage${sharedCart.items.length > 1 ? "s" : ""} sur ${SITE_NAME}.`;

  return {
    title,
    description,
    alternates: {
      canonical: `${SITE_URL}/cart/shared/${token}`,
    },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/cart/shared/${token}`,
      images: [
        {
          url: CART_SHARE_IMAGE_PATH,
          alt: `${SITE_NAME} panier partage`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [CART_SHARE_IMAGE_PATH],
    },
  };
}

export default async function SharedCartPage({ params }: { params: Promise<{ token: string }> }) {
  const [{ token }, pricing, user] = await Promise.all([params, getPricingContext(), getCurrentUser()]);
  const sharedCart = await getSharedCartByToken(token);

  if (!sharedCart) {
    redirect("/cart");
  }

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/cart/shared/${token}`)}`);
  }

  return (
    <InternalPageShell pricing={pricing}>
      <SharedCartClaimClient
        token={sharedCart.token}
        ownerDisplayName={sharedCart.ownerDisplayName}
        message={sharedCart.message}
        itemCount={sharedCart.items.length}
      />
    </InternalPageShell>
  );
}
