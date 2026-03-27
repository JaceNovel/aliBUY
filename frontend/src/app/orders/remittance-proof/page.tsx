import { InternalPageShell } from "@/components/internal-page-shell";
import { RemittanceProofClient } from "@/app/orders/remittance-proof/remittance-proof-client";
import { getUserOrderRecords } from "@/lib/order-service";
import { getPricingContext } from "@/lib/pricing";
import { getCurrentUser } from "@/lib/user-auth";
import { redirect } from "next/navigation";

export default async function RemittanceProofPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string }>;
}) {
  const pricing = await getPricingContext();
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?next=/orders/remittance-proof");
  }

  const resolvedSearchParams = await searchParams;
  const orders = await getUserOrderRecords(user);

  return (
    <InternalPageShell pricing={pricing}>
      <RemittanceProofClient currencyCode={pricing.currency.code} orders={orders} initialOrderId={resolvedSearchParams.orderId} />
    </InternalPageShell>
  );
}