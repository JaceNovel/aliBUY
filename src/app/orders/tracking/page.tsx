import { InternalPageShell } from "@/components/internal-page-shell";
import { TrackingClient } from "@/app/orders/tracking/tracking-client";
import { getPricingContext } from "@/lib/pricing";

export default async function OrderTrackingPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string; tracking?: string }>;
}) {
  const pricing = await getPricingContext();
  const resolvedSearchParams = await searchParams;

  return (
    <InternalPageShell pricing={pricing}>
      <TrackingClient initialOrderId={resolvedSearchParams.orderId} initialTracking={resolvedSearchParams.tracking} />
    </InternalPageShell>
  );
}