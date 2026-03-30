import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminParcelPrintActions } from "@/components/admin-parcel-print-actions";
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
      <section className="rounded-[20px] border border-[#e6eaf0] bg-white px-5 py-5 shadow-[0_8px_22px_rgba(17,24,39,0.05)] print:rounded-none print:border-0 print:shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#ff6a5b]">Bon colis sourcing</div>
            <h1 className="mt-2 text-[30px] font-black tracking-[-0.05em] text-[#1f2937]">{order.orderNumber}</h1>
            <div className="mt-2 text-[13px] leading-6 text-[#667085]">Fiche imprimable pour la préparation, la remise et le retrait colis.</div>
          </div>
          <AdminParcelPrintActions orderHref={`/admin/orders/${encodeURIComponent(order.id)}`} />
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
            <div className="text-[13px] font-semibold text-[#1f2937]">Photos colis</div>
            {parcelSnapshot.photoEntries.length > 0 ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {parcelSnapshot.photoEntries.slice(0, 6).map((photo) => (
                  <div key={photo.id} className="overflow-hidden rounded-[14px] bg-white ring-1 ring-[#edf1f6]">
                    <img src={photo.url} alt={photo.label || "Photo colis"} className="h-44 w-full object-cover" />
                    <div className="px-3 py-2 text-[12px] font-semibold text-[#475467]">{photo.source === "manual" ? (photo.label || "Photo colis manuelle") : photo.source === "proof" ? "Photo/preuve colis" : (photo.label || "Photo source")}</div>
                  </div>
                ))}
              </div>
            ) : <div className="mt-3 text-[13px] text-[#667085]">Aucune photo disponible.</div>}
          </article>
        </div>

        <article className="mt-5 rounded-[16px] bg-[#fafbfd] px-4 py-4 ring-1 ring-[#edf1f6]">
          <div className="text-[13px] font-semibold text-[#1f2937]">Produits et identifiants source</div>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left">
              <thead>
                <tr className="text-[12px] uppercase tracking-[0.08em] text-[#98a2b3]">
                  <th className="py-2 pr-4 font-semibold">Produit</th>
                  <th className="py-2 pr-4 font-semibold">Qté</th>
                  <th className="py-2 pr-4 font-semibold">Fournisseur</th>
                  <th className="py-2 pr-4 font-semibold">Source ID</th>
                  <th className="py-2 pr-4 font-semibold">Conditionnement</th>
                  <th className="py-2 pr-4 font-semibold">Lien</th>
                </tr>
              </thead>
              <tbody>
                {parcelSnapshot.items.map((item, index) => (
                  <tr key={`${item.slug}-${index}`} className="border-t border-[#edf1f6] text-[13px] text-[#1f2937]">
                    <td className="py-3 pr-4">
                      <div className="font-semibold">{item.title}</div>
                      {item.selectionLabel ? <div className="mt-1 text-[12px] text-[#667085]">{item.selectionLabel}</div> : null}
                    </td>
                    <td className="py-3 pr-4">{item.quantity}</td>
                    <td className="py-3 pr-4">{item.supplierName || "-"}</td>
                    <td className="py-3 pr-4">{item.sourceProductId || "-"}</td>
                    <td className="py-3 pr-4">{item.packaging || "-"}</td>
                    <td className="py-3 pr-4">{item.sourceUrl ? <Link href={item.sourceUrl} target="_blank" className="font-semibold text-[#d85300]">Ouvrir</Link> : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </div>
  );
}