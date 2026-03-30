import { InternalPageShell } from "@/components/internal-page-shell";
import { SourcingCheckoutClient } from "@/components/sourcing-checkout-client";
import { getUserAddresses } from "@/lib/customer-data-store";
import { getPricingContext } from "@/lib/pricing";
import { getCurrentUser } from "@/lib/user-auth";
import { redirect } from "next/navigation";

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ promo?: string }>;
}) {
  const pricing = await getPricingContext();
  const resolvedSearchParams = await searchParams;
  const promoCode = typeof resolvedSearchParams.promo === "string" ? resolvedSearchParams.promo.trim().toUpperCase() : "";
  const nextPath = promoCode ? `/checkout?promo=${encodeURIComponent(promoCode)}` : "/checkout";
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  const addresses = await getUserAddresses(user.id);

  return (
    <InternalPageShell pricing={pricing}>
      <SourcingCheckoutClient
        initialUser={{ displayName: user.displayName, email: user.email }}
        savedAddresses={addresses}
        initialCountryCode={pricing.countryCode}
        currencyCode={pricing.currency.code}
        locale={pricing.locale}
        initialPromoCode={promoCode}
      />
    </InternalPageShell>
  );
}