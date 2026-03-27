import Image from "next/image";
import Link from "next/link";

import { CartPageClient } from "@/components/cart-page-client";
import { InternalPageShell } from "@/components/internal-page-shell";
import { getSharedCartSummariesForOwner } from "@/lib/cart-share-store";
import { getPricingContext } from "@/lib/pricing";
import { getCurrentUser } from "@/lib/user-auth";

export default async function CartPage() {
  const pricing = await getPricingContext();
  const user = await getCurrentUser();
  const sharedCartSummaries = user ? await getSharedCartSummariesForOwner(user.id) : [];

  return (
    <InternalPageShell pricing={pricing}>
      <CartPageClient
        currencyCode={pricing.currency.code}
        locale={pricing.locale}
        isAuthenticated={Boolean(user)}
        initialSharedCartSummaries={sharedCartSummaries.map((entry) => ({
          id: entry.id,
          token: entry.token,
          ownerDisplayName: entry.ownerDisplayName,
          status: entry.status,
          claimCount: entry.claimCount,
          claimedByDisplayName: entry.claimedByDisplayName,
          claimedOrderId: entry.claimedOrderId,
          updatedAt: entry.updatedAt,
        }))}
      />
      <div className="hidden">
        <Image src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="" width={1} height={1} />
      </div>
      <Link href="/orders" className="hidden">orders</Link>
    </InternalPageShell>
  );
}