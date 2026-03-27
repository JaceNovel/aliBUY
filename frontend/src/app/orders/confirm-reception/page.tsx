import { InternalPageShell } from "@/components/internal-page-shell";
import { ConfirmReceptionClient } from "@/app/orders/confirm-reception/confirm-reception-client";
import { getUserOrderRecordById } from "@/lib/order-service";
import { getPricingContext } from "@/lib/pricing";
import { getCurrentUser } from "@/lib/user-auth";
import { notFound, redirect } from "next/navigation";

export default async function ConfirmReceptionPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string }>;
}) {
  const pricing = await getPricingContext();
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?next=/orders/confirm-reception");
  }

  const resolvedSearchParams = await searchParams;
  const order = await getUserOrderRecordById(user, resolvedSearchParams.orderId);

  if (!order) {
    notFound();
  }

  return (
    <InternalPageShell pricing={pricing}>
      <ConfirmReceptionClient
        order={{
          id: order.id,
          title: order.title,
          total: order.total,
          image: order.image,
          seller: order.seller,
        }}
      />
    </InternalPageShell>
  );
}