import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

import { AdminOrderDetailClient } from "@/components/admin-order-detail-client";
import { getAdminOrderById } from "@/lib/admin-data";
import { getPricingContext } from "@/lib/pricing";

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ orderId: string }> }) {
  const pricing = await getPricingContext();
  const { orderId } = await params;
  const order = await getAdminOrderById(orderId);

  if (!order) {
    notFound();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#ff6a5b]">Commande</div>
          <h1 className="mt-2 text-[32px] font-black tracking-[-0.05em] text-[#1f2937]">{order.orderNumber}</h1>
          <p className="mt-2 text-[14px] leading-6 text-[#667085]">Détail complet de la commande client, des articles commandés et de l&apos;adresse de livraison enregistrée.</p>
        </div>
        <Link href="/admin/orders" className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[#d7dce5] px-5 text-[14px] font-semibold text-[#1f2937] transition hover:border-[#ff6a5b] hover:text-[#ff6a5b]">
          <ArrowLeft className="h-4 w-4" />
          Retour aux commandes
        </Link>
      </div>

      <AdminOrderDetailClient order={order} currencyCode={pricing.currency.code} locale={pricing.locale} />
    </div>
  );
}