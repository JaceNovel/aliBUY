import { CartPageClient } from "@/components/cart-page-client";
import { InternalPageShell } from "@/components/internal-page-shell";
import { getSharedCartSummariesForOwner } from "@/lib/cart-share-store";
import { getPricingContext } from "@/lib/pricing";
import { getCurrentUser } from "@/lib/user-auth";

type SharedCartSummary = Awaited<ReturnType<typeof getSharedCartSummariesForOwner>>[number];

export default async function CartPage() {
  const pricing = await getPricingContext();
  const user = await getCurrentUser();
  const sharedCartSummaries = user
    ? await getSharedCartSummariesForOwner(user.id).catch((error) => {
        console.warn("[cart-page] unable to load shared cart summaries", error);
        return [] as SharedCartSummary[];
      })
    : [];

  return (
    <InternalPageShell pricing={pricing}>
      <CartPageClient
        currencyCode={pricing.currency.code}
        locale={pricing.locale}
        languageCode={pricing.languageCode}
        initialCountryCode={pricing.countryCode}
        isAuthenticated={Boolean(user)}
        initialSharedCartSummaries={sharedCartSummaries.map((entry: SharedCartSummary) => ({
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
    </InternalPageShell>
  );
}
