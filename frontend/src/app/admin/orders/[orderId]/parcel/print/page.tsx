import { notFound } from "next/navigation";

import { AdminAutoPrint } from "@/components/admin-auto-print";
import { getAdminOrderById, getAdminOrderParcelSnapshot } from "@/lib/admin-data";

export default async function AdminOrderParcelPrintPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const order = await getAdminOrderById(orderId);

  if (!order) {
    notFound();
  }

  const parcelSnapshot = await getAdminOrderParcelSnapshot(order);

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-5 print:max-w-none print:px-0 print:py-0">
      <AdminAutoPrint />
      <section className="rounded-[20px] border border-[#e6eaf0] bg-white px-5 py-5 shadow-[0_8px_22px_rgba(17,24,39,0.05)] print:rounded-none print:border-0 print:shadow-none">
        <div>
          <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#ff6a5b]">Bon colis sourcing</div>
          <h1 className="mt-2 text-[30px] font-black tracking-[-0.05em] text-[#1f2937]">{order.orderNumber}</h1>
          <div className="mt-2 text-[13px] leading-6 text-[#667085]">Version impression automatique pour la préparation, la remise et le retrait colis.</div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-4">
          <div className="rounded-[16px] bg-[#fafbfd] px-4 py-4 ring-1 ring-[#edf1f6]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#98a2b3]">Client</div>
            <div className="mt-1 text-[15px] font-semibold text-[#1f2937]">{order.customerName}</div>
            <div className="mt-1 text-[12px] text-[#667085]">{order.customerPhone}</div>
          </div>
          <div className="rounded-[16px] bg-[#fafbfd] px-4 py-4 ring-1 ring-[#edf1f6]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#98a2b3]">Route</div>
            <div className="mt-1 text-[15px] font-semibold text-[#1f2937]">{parcelSnapshot.routing.routeLabel}</div>
            <div className="mt-1 text-[12px] text-[#667085]">{parcelSnapshot.routing.destinationLabel}</div>
          </div>
          <div className="rounded-[16px] bg-[#fafbfd] px-4 py-4 ring-1 ring-[#edf1f6]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#98a2b3]">Pickup</div>
            <div className="mt-1 text-[15px] font-semibold text-[#1f2937]">{parcelSnapshot.routing.pickupLabel}</div>
            <div className="mt-1 text-[12px] text-[#667085]">{parcelSnapshot.routing.pickupReadyAt ? `Disponible ${new Date(parcelSnapshot.routing.pickupReadyAt).toLocaleString("fr-FR")}` : "Pas encore publié"}</div>
          </div>
          <div className="rounded-[16px] bg-[#fafbfd] px-4 py-4 ring-1 ring-[#edf1f6]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#98a2b3]">Articles</div>
            <div className="mt-1 text-[15px] font-semibold text-[#1f2937]">{parcelSnapshot.totalItems} produit(s)</div>
            <div className="mt-1 text-[12px] text-[#667085]">{parcelSnapshot.totalUnits} unité(s)</div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <article className="rounded-[16px] bg-[#fafbfd] px-4 py-4 ring-1 ring-[#edf1f6]">
            <div className="text-[13px] font-semibold text-[#1f2937]">Routage et retrait</div>
            {parcelSnapshot.routing.pickupAddress ? <div className="mt-3 whitespace-pre-wrap text-[13px] leading-6 text-[#475467]">{parcelSnapshot.routing.pickupAddress}</div> : null}
            <div className="mt-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-[#98a2b3]">Adresse client finale</div>
            <div className="mt-2 text-[13px] leading-6 text-[#475467]">{parcelSnapshot.routing.clientAddressLines.map((line) => <div key={line}>{line}</div>)}</div>
            {parcelSnapshot.manualNote ? (
              <>
                <div className="mt-4 text-[12px] font-semibold uppercase tracking-[0.08em] text-[#98a2b3]">Note colis</div>
                <div className="mt-2 whitespace-pre-wrap text-[13px] leading-6 text-[#475467]">{parcelSnapshot.manualNote}</div>
              </>
            ) : null}
          </article>

          <article className="rounded-[16px] bg-[#fafbfd] px-4 py-4 ring-1 ring-[#edf1f6]">
            <div className="text-[13px] font-semibold text-[#1f2937]">Produits et source</div>
            <div className="mt-3 space-y-3">
              {parcelSnapshot.items.map((item, index) => (
                <div key={`${item.slug}-${index}`} className="rounded-[14px] bg-white px-4 py-4 ring-1 ring-[#edf1f6]">
                  <div className="text-[14px] font-semibold text-[#1f2937]">{item.title}</div>
                  <div className="mt-1 text-[12px] text-[#667085]">Qté: {item.quantity}{item.selectionLabel ? ` · ${item.selectionLabel}` : ""}</div>
                  <div className="mt-1 text-[12px] text-[#667085]">Fournisseur: {item.supplierName || "-"}</div>
                  <div className="mt-1 text-[12px] text-[#667085]">Source ID: {item.sourceProductId || "-"}</div>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}