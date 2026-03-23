import { InternalPageShell } from "@/components/internal-page-shell";
import { SourcingCheckoutClient } from "@/components/sourcing-checkout-client";
import { getPricingContext } from "@/lib/pricing";
import { getCurrentUser } from "@/lib/user-auth";
import { redirect } from "next/navigation";

export default async function CheckoutPage() {
  const pricing = await getPricingContext();
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?next=/checkout");
  }

  return (
    <InternalPageShell pricing={pricing}>
      <SourcingCheckoutClient initialUser={{ displayName: user.displayName, email: user.email }} />
    </InternalPageShell>
  );
}