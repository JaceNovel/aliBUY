import { notFound } from "next/navigation";

import { AdminParcelPrintActions } from "@/components/admin-parcel-print-actions";
import { AdminSourcingDeliveryNote } from "@/components/admin-sourcing-delivery-note";
import { getDeliveryNoteDocumentNumber, getDeliveryNoteExportHistory } from "@/lib/admin-sourcing-delivery-note-data";
import { getAdminOrderById, getAdminOrderParcelSnapshot } from "@/lib/admin-data";

export default async function AdminOrderParcelPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const order = await getAdminOrderById(orderId);

  if (!order) {
    notFound();
  }

  const parcelSnapshot = await getAdminOrderParcelSnapshot(order);
  const documentNumber = getDeliveryNoteDocumentNumber(order);
  const exportHistory = getDeliveryNoteExportHistory(order);

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-5 print:max-w-none print:px-0 print:py-0">
      <section className="space-y-4 print:space-y-0">
        <div className="flex flex-wrap items-start justify-between gap-4 print:hidden">
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#ff6a5b]">Bon client</div>
            <h1 className="mt-2 text-[30px] font-black tracking-[-0.05em] text-[#1f2937]">{order.orderNumber}</h1>
            <div className="mt-2 text-[13px] leading-6 text-[#667085]">Apercu du bon de sourcing client remis hors Union europeenne.</div>
            <div className="mt-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-[#98a2b3]">Document {documentNumber}</div>
          </div>
          <AdminParcelPrintActions orderHref={`/admin/orders/${encodeURIComponent(order.id)}`} pdfHref={`/api/admin/sourcing/orders/${encodeURIComponent(order.id)}/delivery-note`} documentNumber={documentNumber} />
        </div>
        <div className="rounded-[18px] border border-[#e6eaf0] bg-[#fbfcfe] px-4 py-4 print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#98a2b3]">Historique d&apos;exports PDF</div>
              <div className="mt-1 text-[14px] font-semibold text-[#1f2937]">{exportHistory.length} export(s) enregistres</div>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            {exportHistory.length > 0 ? exportHistory.slice(0, 8).map((entry) => (
              <div key={entry.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-[#edf1f6] bg-white px-3 py-3 text-[12px] text-[#475467]">
                <span className="font-semibold text-[#1f2937]">{entry.documentNumber}</span>
                <span>{entry.disposition === "inline" ? "Apercu / impression" : "Telechargement"}</span>
                <span>{new Date(entry.exportedAt).toLocaleString("fr-FR")}</span>
                <span>{entry.exportedByEmail || "Admin"}</span>
              </div>
            )) : <div className="text-[13px] text-[#667085]">Aucun export PDF enregistre pour cette commande.</div>}
          </div>
        </div>
        <AdminSourcingDeliveryNote order={order} parcelSnapshot={parcelSnapshot} />
      </section>
    </div>
  );
}
