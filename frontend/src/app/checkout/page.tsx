import { InternalPageShell } from "@/components/internal-page-shell";
import { SourcingCheckoutClient } from "@/components/sourcing-checkout-client";
import { getUserAddresses } from "@/lib/customer-data-store";
import { getPricingContext } from "@/lib/pricing";
import { getCurrentUser } from "@/lib/user-auth";
import { redirect } from "next/navigation";

export default async function CheckoutPage() {
  const pricing = await getPricingContext();
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?next=/checkout");
  }

  const addresses = await getUserAddresses(user.id);

  return (
    <InternalPageShell pricing={pricing}>
      <SourcingCheckoutClient
        initialUser={{ displayName: user.displayName, email: user.email }}
        savedAddresses={addresses}
        currencyCode={pricing.currency.code}
        locale={pricing.locale}
      />
    </InternalPageShell>
  );
}