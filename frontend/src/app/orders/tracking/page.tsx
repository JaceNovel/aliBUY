import { InternalPageShell } from "@/components/internal-page-shell";
import { TrackingClient } from "@/app/orders/tracking/tracking-client";
import { getUserOrderRecordById, getUserOrderRecordByTracking, getUserOrderRecords } from "@/lib/order-service";
import { getPricingContext } from "@/lib/pricing";
import { getCurrentUser } from "@/lib/user-auth";
import { redirect } from "next/navigation";

export default async function OrderTrackingPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string; tracking?: string }>;
}) {
  const pricing = await getPricingContext();
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?next=/orders/tracking");
  }

  const resolvedSearchParams = await searchParams;
  const orders = await getUserOrderRecords(user);
  const selectedOrder = await getUserOrderRecordById(user, resolvedSearchParams.orderId)
    ?? await getUserOrderRecordByTracking(user, resolvedSearchParams.tracking)
    ?? orders[0]
    ?? null;

  return (
    <InternalPageShell pricing={pricing}>
      <TrackingClient orders={orders} initialOrderId={selectedOrder?.id} initialTracking={resolvedSearchParams.tracking} />
    </InternalPageShell>
  );
}