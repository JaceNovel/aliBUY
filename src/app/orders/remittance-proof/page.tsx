import { InternalPageShell } from "@/components/internal-page-shell";
import { RemittanceProofClient } from "@/app/orders/remittance-proof/remittance-proof-client";
import { getPricingContext } from "@/lib/pricing";
export default async function RemittanceProofPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string }>;
}) {
  const pricing = await getPricingContext();
  const resolvedSearchParams = await searchParams;

  return (
    <InternalPageShell pricing={pricing}>
      <RemittanceProofClient currencyCode={pricing.currency.code} initialOrderId={resolvedSearchParams.orderId} />
    </InternalPageShell>
  );
}