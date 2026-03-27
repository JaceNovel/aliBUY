import { redirect } from "next/navigation";

import { SharedCartClaimClient } from "@/app/cart/shared/[token]/shared-cart-claim-client";
import { InternalPageShell } from "@/components/internal-page-shell";
import { getSharedCartByToken } from "@/lib/cart-share-store";
import { getPricingContext } from "@/lib/pricing";
import { getCurrentUser } from "@/lib/user-auth";

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