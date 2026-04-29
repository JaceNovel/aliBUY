import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

import { AdminOrderDetailClient } from "@/components/admin-order-detail-client";
import { getAdminOrderById, getAdminOrderParcelSnapshot, getAdminOrders } from "@/lib/admin-data";
import { getPricingContext } from "@/lib/pricing";
import { getCurrentUser } from "@/lib/user-auth";
import { previewAdminOrderRecord, previewParcelSnapshot, previewSourcingOrder } from "@/app/preview/admin-orders/preview-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminOrderDetailPreviewPage({ params }: { params: Promise<{ orderId: string }> }) {
  const pricing = await getPricingContext();
  const currentUser = await getCurrentUser();
  const { orderId } = await params;
  const localOrder = await getAdminOrderById(orderId);
  const order = localOrder ?? (orderId === previewSourcingOrder.id ? previewSourcingOrder : null);

  if (!order) {
    notFound();
  }

  const orders = await getAdminOrders({ preferProxy: false });
  const orderSummary = (orders.length > 0 ? orders : [previewAdminOrderRecord]).find((entry) => entry.id === order.id || entry.orderNumber === order.orderNumber);
  const parcelSnapshot = localOrder ? await getAdminOrderParcelSnapshot(order) : previewParcelSnapshot;

  return (
    <div className="space-y-5 px-4 py-5 sm:px-6 lg:px-8">
      <div className="rounded-[18px] border border-[#d9e2f2] bg-[#f8fbff] px-4 py-3 text-[13px] font-medium text-[#36517a]">
        Prévisualisation locale de la fiche admin commande.
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[30px] font-black tracking-[-0.05em] text-[#ff4d4f]">Détail commande</h1>
          <p className="mt-1 text-[16px] text-[#667085]">Commande #{orderSummary?.displayNumber ?? order.orderNumber}</p>
        </div>
        <Link href="/preview/admin-orders" className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[#d7dce5] px-5 text-[14px] font-semibold text-[#1f2937] transition hover:border-[#ff6a5b] hover:text-[#ff6a5b]">
          <ArrowLeft className="h-4 w-4" />
          Retour aux commandes
        </Link>
      </div>

      <AdminOrderDetailClient
        order={order}
        parcelSnapshot={parcelSnapshot}
        currencyCode={pricing.currency.code}
        locale={pricing.locale}
        defaultCourierName={currentUser?.displayName}
        displayNumber={orderSummary?.displayNumber}
      />
    </div>
  );
}