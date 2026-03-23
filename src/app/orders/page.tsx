import { InternalPageShell } from "@/components/internal-page-shell";
import { OrdersClient } from "@/app/orders/orders-client";
import { getUserOrderRecords } from "@/lib/order-service";
import { getPricingContext } from "@/lib/pricing";
import { getCurrentUser } from "@/lib/user-auth";
import { redirect } from "next/navigation";

export default async function OrdersPage() {
  const pricing = await getPricingContext();
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?next=/orders");
  }

  const orders = await getUserOrderRecords(user);

  return (
    <InternalPageShell pricing={pricing}>
      <OrdersClient orders={orders} />
    </InternalPageShell>
  );
}