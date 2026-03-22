import { InternalPageShell } from "@/components/internal-page-shell";
import { OrdersClient } from "@/app/orders/orders-client";
import { getPricingContext } from "@/lib/pricing";

export default async function OrdersPage() {
  const pricing = await getPricingContext();

  return (
    <InternalPageShell pricing={pricing}>
      <OrdersClient />
    </InternalPageShell>
  );
}