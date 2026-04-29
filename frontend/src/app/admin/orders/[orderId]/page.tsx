import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

import { AdminOrderDetailClient } from "@/components/admin-order-detail-client";
import { getCurrentUser } from "@/lib/user-auth";
import { getAdminOrderById, getAdminOrderParcelSnapshot, getAdminOrders } from "@/lib/admin-data";
import { getPricingContext } from "@/lib/pricing";

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ orderId: string }> }) {
  const pricing = await getPricingContext();
  const currentUser = await getCurrentUser();
  const { orderId } = await params;
  const order = await getAdminOrderById(orderId);

  if (!order) {
    notFound();
  }

  const orders = await getAdminOrders();
  const orderSummary = orders.find((entry) => entry.id === order.id || entry.orderNumber === order.orderNumber);
  const parcelSnapshot = await getAdminOrderParcelSnapshot(order);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[30px] font-black tracking-[-0.05em] text-[#ff4d4f]">Détail commande</h1>
          <p className="mt-1 text-[16px] text-[#667085]">Commande #{orderSummary?.displayNumber ?? order.orderNumber}</p>
        </div>
        <Link href="/admin/orders" className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[#d7dce5] px-5 text-[14px] font-semibold text-[#1f2937] transition hover:border-[#ff6a5b] hover:text-[#ff6a5b]">
          <ArrowLeft className="h-4 w-4" />
          Retour aux commandes
        </Link>
      </div>

      <AdminOrderDetailClient order={order} parcelSnapshot={parcelSnapshot} currencyCode={pricing.currency.code} locale={pricing.locale} defaultCourierName={currentUser?.displayName} displayNumber={orderSummary?.displayNumber} />
    </div>
  );
}