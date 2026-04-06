import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminParcelPrintActions } from "@/components/admin-parcel-print-actions";
import { AdminSourcingDeliveryNote } from "@/components/admin-sourcing-delivery-note";
import { getAdminOrderById, getAdminOrderParcelSnapshot } from "@/lib/admin-data";

export default async function AdminOrderParcelPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const order = await getAdminOrderById(orderId);

  if (!order) {
    notFound();
  }

  const parcelSnapshot = await getAdminOrderParcelSnapshot(order);

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-5 print:max-w-none print:px-0 print:py-0">
      <section className="space-y-4 print:space-y-0">
        <div className="flex flex-wrap items-start justify-between gap-4 print:hidden">
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#ff6a5b]">Bon client</div>
            <h1 className="mt-2 text-[30px] font-black tracking-[-0.05em] text-[#1f2937]">{order.orderNumber}</h1>
            <div className="mt-2 text-[13px] leading-6 text-[#667085]">Apercu du bon de sourcing client remis hors Union europeenne.</div>
          </div>
          <AdminParcelPrintActions orderHref={`/admin/orders/${encodeURIComponent(order.id)}`} />
        </div>
        <AdminSourcingDeliveryNote order={order} parcelSnapshot={parcelSnapshot} />
      </section>
    </div>
  );
}