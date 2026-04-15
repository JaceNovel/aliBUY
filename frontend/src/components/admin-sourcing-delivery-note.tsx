import Image from "next/image";

import type { SourcingOrder } from "@/lib/alibaba-sourcing";
import {
  AFRIPAY_COMPANY_ADDRESS,
  AFRIPAY_COMPANY_EMAIL,
  AFRIPAY_COMPANY_NAME,
  AFRIPAY_COMPANY_PHONE,
  AFRIPAY_COMPANY_ROLE,
} from "@/lib/afripay-logistics";
import type { AdminOrderParcelSnapshot } from "@/lib/admin-order-parcel";
import {
  getDeliveryNoteCourierContact,
  getDeliveryNoteCustomerAddressLines,
  getDeliveryNoteDocumentNumber,
  getDeliveryNoteTradeAreaDescription,
  getDeliveryNoteTradeAreaLabel,
} from "@/lib/admin-sourcing-delivery-note-data";
import { SITE_LOGO_PATH } from "@/lib/site-config";

const moneyFormatter = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "long",
  timeStyle: "short",
});

function formatMoney(value: number) {
  return `${moneyFormatter.format(Math.max(0, value))} FCFA`;
}

function formatDateTime(value?: string) {
  if (!value) {
    return "A confirmer";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "A confirmer";
  }

  return dateFormatter.format(date);
}

function getShippingMethodLabel(order: SourcingOrder) {
  switch (order.shippingMethod) {
    case "air":
      return "Expedition aerienne";
    case "sea":
      return "Expedition maritime";
    case "freight":
      return "Transit / fret";
    default:
      return order.shippingMethod;
  }
}

function getPaymentStatusLabel(order: SourcingOrder) {
  switch (order.paymentStatus) {
    case "paid":
      return "Regle";
    case "pending":
      return "Paiement en attente";
    case "initialized":
      return "Paiement initialise";
    case "failed":
      return "Paiement echoue";
    case "cancelled":
      return "Paiement annule";
    default:
      return "Non regle";
  }
}
export function AdminSourcingDeliveryNote({ order, parcelSnapshot }: { order: SourcingOrder; parcelSnapshot: AdminOrderParcelSnapshot }) {
  const customerAddressLines = getDeliveryNoteCustomerAddressLines(order, parcelSnapshot);
  const courierContact = getDeliveryNoteCourierContact(order);
  const documentNumber = getDeliveryNoteDocumentNumber(order);
  const tradeAreaLabel = getDeliveryNoteTradeAreaLabel(order);
  const tradeAreaDescription = getDeliveryNoteTradeAreaDescription(order);

  return (
    <article className="mx-auto overflow-hidden rounded-[24px] border border-[#d9e2ec] bg-white text-[#14213d] shadow-[0_18px_45px_rgba(20,33,61,0.08)] print:min-h-[273mm] print:w-[186mm] print:rounded-none print:border-0 print:shadow-none">
      <style>{`@page { size: A4 portrait; margin: 12mm; }`}</style>
      <div className="border-b border-[#d9e2ec] bg-[linear-gradient(135deg,#fff8ef_0%,#f7fbff_55%,#eef4ff_100%)] px-6 py-6 print:px-0 print:pt-0">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-3xl">
            <div className="flex items-center gap-4">
              <div className="relative h-16 w-40 shrink-0 print:h-14 print:w-36">
                <Image src={SITE_LOGO_PATH} alt="Logo AfriPay" fill className="object-contain object-left" priority />
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#b54708]">Bon de sourcing client</div>
                <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#667085]">Document {documentNumber}</div>
              </div>
            </div>
            <h1 className="mt-3 text-[30px] font-black tracking-[-0.05em] text-[#14213d]">{order.orderNumber}</h1>
            <p className="mt-3 max-w-2xl text-[13px] leading-6 text-[#475467]">
              Bon de remise client. Il reprend l'essentiel de la commande, de la livraison et du suivi logistique pour impression rapide.
            </p>
          </div>

          <div className="min-w-[240px] rounded-[20px] border border-[#d9e2ec] bg-white/90 px-5 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#98a2b3]">Emetteur</div>
            <div className="mt-2 text-[18px] font-bold text-[#14213d]">{AFRIPAY_COMPANY_NAME}</div>
            <div className="mt-2 text-[12px] leading-5 text-[#475467]">{AFRIPAY_COMPANY_ROLE}</div>
            <div className="mt-1 text-[12px] leading-5 text-[#475467]">{AFRIPAY_COMPANY_ADDRESS}</div>
            <div className="mt-1 text-[12px] leading-5 text-[#475467]">Tel: {AFRIPAY_COMPANY_PHONE}</div>
            <div className="mt-1 text-[12px] leading-5 text-[#475467]">Email: {AFRIPAY_COMPANY_EMAIL}</div>
            <div className="mt-2 text-[12px] leading-5 text-[#475467]">Numero documentaire: {documentNumber}</div>
            <div className="mt-2 text-[12px] leading-5 text-[#475467]">Reference interne: {order.id}</div>
            <div className="mt-1 text-[12px] leading-5 text-[#475467]">Emission: {formatDateTime(order.updatedAt || order.createdAt)}</div>
            <div className="mt-1 text-[12px] leading-5 text-[#475467]">Zone de livraison: {tradeAreaLabel}</div>
          </div>
        </div>
      </div>

      <div className="space-y-5 px-6 py-6 print:px-0">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[18px] border border-[#e5ebf2] bg-[#fbfcfe] px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#98a2b3]">Client destinataire</div>
            <div className="mt-2 text-[16px] font-bold text-[#14213d]">{order.customerName}</div>
            <div className="mt-1 text-[13px] text-[#475467]">{order.customerPhone}</div>
            <div className="mt-1 text-[13px] text-[#475467]">{order.customerEmail}</div>
          </div>

          <div className="rounded-[18px] border border-[#e5ebf2] bg-[#fbfcfe] px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#98a2b3]">Livraison</div>
            <div className="mt-2 text-[16px] font-bold text-[#14213d]">{parcelSnapshot.routing.destinationLabel}</div>
            <div className="mt-1 text-[13px] text-[#475467]">{getShippingMethodLabel(order)}</div>
            <div className="mt-1 text-[13px] text-[#475467]">Remise: {parcelSnapshot.routing.pickupLabel}</div>
            <div className="mt-1 text-[13px] text-[#475467]">{tradeAreaDescription}</div>
          </div>

          <div className="rounded-[18px] border border-[#e5ebf2] bg-[#fbfcfe] px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#98a2b3]">Statut commande</div>
            <div className="mt-2 text-[16px] font-bold text-[#14213d]">{getPaymentStatusLabel(order)}</div>
            <div className="mt-1 text-[13px] text-[#475467]">Creation: {formatDateTime(order.createdAt)}</div>
            <div className="mt-1 text-[13px] text-[#475467]">Mise a disposition: {formatDateTime(parcelSnapshot.routing.pickupReadyAt)}</div>
          </div>

          <div className="rounded-[18px] border border-[#e5ebf2] bg-[#fbfcfe] px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#98a2b3]">Synthese</div>
            <div className="mt-2 text-[16px] font-bold text-[#14213d]">{parcelSnapshot.totalUnits} unite(s)</div>
            <div className="mt-1 text-[13px] text-[#475467]">{parcelSnapshot.totalItems} ligne(s) de commande</div>
            <div className="mt-1 text-[13px] text-[#475467]">Poids declare: {order.totalWeightKg.toFixed(2)} kg</div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[22px] border border-[#d9e2ec] bg-white px-5 py-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[#98a2b3]">Commande client</div>
                <div className="mt-1 text-[18px] font-bold text-[#14213d]">Detail des articles</div>
              </div>
              <div className="rounded-full bg-[#fff3e8] px-3 py-1 text-[12px] font-semibold text-[#b54708]">{tradeAreaLabel}</div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0 text-left">
                <thead>
                  <tr className="text-[11px] uppercase tracking-[0.08em] text-[#98a2b3]">
                    <th className="border-b border-[#e5ebf2] py-3 pr-4 font-semibold">Article</th>
                    <th className="border-b border-[#e5ebf2] py-3 pr-4 font-semibold">Details</th>
                    <th className="border-b border-[#e5ebf2] py-3 pr-4 font-semibold">Qté</th>
                    <th className="border-b border-[#e5ebf2] py-3 pr-0 font-semibold">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {parcelSnapshot.items.map((item, index) => (
                    <tr key={`${item.slug}-${index}`} className="align-top text-[13px] text-[#14213d]">
                      <td className="border-b border-[#eef2f6] py-4 pr-4">
                        <div className="font-semibold">{item.title}</div>
                        {item.image ? <div className="mt-1 text-[12px] text-[#667085]">Ref: {item.slug}</div> : null}
                      </td>
                      <td className="border-b border-[#eef2f6] py-4 pr-4 text-[#475467]">
                        <div>{item.selectionLabel || "Specification standard"}</div>
                        {item.packaging ? <div className="mt-1 text-[12px]">Conditionnement: {item.packaging}</div> : null}
                        {item.overview[0] ? <div className="mt-2 text-[12px] leading-5">{item.overview[0]}</div> : null}
                      </td>
                      <td className="border-b border-[#eef2f6] py-4 pr-4 font-semibold">{item.quantity}</td>
                      <td className="border-b border-[#eef2f6] py-4 pr-0 text-[#475467]">
                        <div>{item.supplierName || "Approvisionnement multi-sources"}</div>
                        {item.supplierLocation ? <div className="mt-1 text-[12px]">{item.supplierLocation}</div> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-5">
            <section className="rounded-[22px] border border-[#d9e2ec] bg-[#fbfcfe] px-5 py-5">
              <div className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[#98a2b3]">Adresse de remise</div>
              <div className="mt-3 space-y-1 text-[14px] leading-6 text-[#14213d]">
                {customerAddressLines.map((line) => (
                  <div key={line}>{line}</div>
                ))}
              </div>
              {parcelSnapshot.routing.pickupAddress ? (
                <>
                  <div className="mt-4 text-[12px] font-semibold uppercase tracking-[0.1em] text-[#98a2b3]">Point de retrait / relais</div>
                  <div className="mt-2 whitespace-pre-wrap text-[13px] leading-6 text-[#475467]">{parcelSnapshot.routing.pickupAddress}</div>
                </>
              ) : null}
            </section>

            <section className="rounded-[22px] border border-[#d9e2ec] bg-[#fbfcfe] px-5 py-5 print:break-inside-avoid">
              <div className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[#98a2b3]">Contact logistique</div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="rounded-[18px] border border-[#e5ebf2] bg-white px-4 py-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#98a2b3]">Entreprise</div>
                  <div className="mt-2 text-[15px] font-bold text-[#14213d]">{AFRIPAY_COMPANY_NAME}</div>
                  <div className="mt-1 text-[12px] leading-5 text-[#475467]">{AFRIPAY_COMPANY_ADDRESS}</div>
                  <div className="mt-2 text-[12px] leading-5 text-[#475467]">Tel: {AFRIPAY_COMPANY_PHONE}</div>
                  <div className="mt-1 text-[12px] leading-5 text-[#475467]">Email: {AFRIPAY_COMPANY_EMAIL}</div>
                </div>
                <div className="rounded-[18px] border border-[#e5ebf2] bg-white px-4 py-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#98a2b3]">Livreur / remise</div>
                  <div className="mt-2 text-[15px] font-bold text-[#14213d]">{courierContact.courierName}</div>
                  <div className="mt-1 text-[12px] leading-5 text-[#475467]">Point de service: {courierContact.courierCheckpoint}</div>
                  <div className="mt-2 text-[12px] leading-5 text-[#475467]">Tel: {courierContact.courierPhone}</div>
                  <div className="mt-1 text-[12px] leading-5 text-[#475467]">Base logistique: {AFRIPAY_COMPANY_ADDRESS}</div>
                  <div className="mt-1 text-[12px] leading-5 text-[#475467]">Disponibilite: {courierContact.courierEta}</div>
                </div>
              </div>
            </section>

            <section className="rounded-[22px] border border-[#d9e2ec] bg-[#fbfcfe] px-5 py-5">
              <div className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[#98a2b3]">Montants</div>
              <div className="mt-4 space-y-3 text-[14px] text-[#14213d]">
                <div className="flex items-center justify-between gap-3">
                  <span>Valeur produits</span>
                  <span className="font-semibold">{formatMoney(order.cartProductsTotalFcfa)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Frais logistiques</span>
                  <span className="font-semibold">{formatMoney(order.shippingCostFcfa)}</span>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-[#e5ebf2] pt-3 text-[16px] font-bold">
                  <span>Total commande</span>
                  <span>{formatMoney(order.totalPriceFcfa)}</span>
                </div>
              </div>
            </section>

            <section className="rounded-[22px] border border-[#d9e2ec] bg-[#14213d] px-5 py-5 text-white">
              <div className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[#d0d5dd]">Observation logistique</div>
              <p className="mt-3 text-[13px] leading-6 text-white/88">
                {parcelSnapshot.manualNote || "Commande prete pour remise client ou poursuite du suivi logistique AfriPay."}
              </p>
              <div className="mt-4 text-[12px] leading-6 text-white/72">Contact remise: {courierContact.courierName} · {courierContact.courierPhone}</div>
            </section>
          </div>
        </section>
      </div>
    </article>
  );
}