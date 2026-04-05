import { InternalPageShell } from "@/components/internal-page-shell";
import { OrdersClient } from "@/app/orders/orders-client";
import { getUserOrderRecords } from "@/lib/order-service";
import { getPricingContext } from "@/lib/pricing";
import { getCurrentUser } from "@/lib/user-auth";
import { redirect } from "next/navigation";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string; paymentId?: string; paymentStatus?: string; status?: string; payOrderId?: string; payment?: string }>;
}) {
  const pricing = await getPricingContext();
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?next=/orders");
  }

  const resolvedSearchParams = await searchParams;
  const orders = await getUserOrderRecords(user);

  return (
    <InternalPageShell pricing={pricing}>
      <OrdersClient
        orders={orders}
        languageCode={pricing.languageCode}
        paymentAction={{
          orderId: resolvedSearchParams.orderId,
          paymentId: resolvedSearchParams.paymentId,
          paymentStatus: resolvedSearchParams.paymentStatus ?? resolvedSearchParams.status,
          payOrderId: resolvedSearchParams.payOrderId,
          payment: resolvedSearchParams.payment,
        }}
      />
    </InternalPageShell>
  );
}
