import { InternalPageShell } from "@/components/internal-page-shell";
import { SourcingCheckoutClient } from "@/components/sourcing-checkout-client";
import { getPricingContext } from "@/lib/pricing";

export default async function CheckoutPage() {
  const pricing = await getPricingContext();

  return (
    <InternalPageShell pricing={pricing}>
      <SourcingCheckoutClient />
    </InternalPageShell>
  );
}