import Link from "next/link";
import { ArrowLeft, MapPinned, Package2, ReceiptText, Truck } from "lucide-react";
import { notFound } from "next/navigation";

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
          <p className="mt-2 text-[14px] leading-6 text-[#667085]">Détail complet de la commande client, des articles commandés et de l'adresse de livraison enregistrée.</p>
        </div>
        <Link href="/admin/orders" className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[#d7dce5] px-5 text-[14px] font-semibold text-[#1f2937] transition hover:border-[#ff6a5b] hover:text-[#ff6a5b]">
          <ArrowLeft className="h-4 w-4" />
          Retour aux commandes
        </Link>
      </div>

      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <article className="rounded-[20px] border border-[#e6eaf0] bg-white px-5 py-5 shadow-[0_8px_22px_rgba(17,24,39,0.05)]">
          <div className="flex items-center gap-3 text-[18px] font-bold text-[#1f2937]">
            <ReceiptText className="h-5 w-5 text-[#ff6a5b]" />
            Informations client
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#98a2b3]">Client</div>
              <div className="mt-1 text-[15px] font-semibold text-[#1f2937]">{order.customerName}</div>
            </div>
            <div>
              <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#98a2b3]">Email</div>
              <div className="mt-1 text-[15px] text-[#1f2937]">{order.customerEmail}</div>
            </div>
            <div>
              <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#98a2b3]">Téléphone</div>
              <div className="mt-1 text-[15px] text-[#1f2937]">{order.customerPhone}</div>
            </div>
            <div>
              <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#98a2b3]">Paiement</div>
              <div className="mt-1 text-[15px] font-semibold text-[#1f2937]">{order.paymentStatus}</div>
            </div>
            <div>
              <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#98a2b3]">Statut</div>
              <div className="mt-1 text-[15px] font-semibold text-[#1f2937]">{order.status}</div>
            </div>
            <div>
              <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#98a2b3]">Livraison</div>
              <div className="mt-1 text-[15px] font-semibold text-[#1f2937]">{order.shippingMethod.toUpperCase()}</div>
            </div>
          </div>

          <div className="mt-5 rounded-[18px] bg-[#fafbfd] px-4 py-4 ring-1 ring-[#edf1f6]">
            <div className="flex items-center gap-2 text-[15px] font-semibold text-[#1f2937]">
              <MapPinned className="h-4 w-4 text-[#ff6a5b]" />
              Adresse de livraison
            </div>
            <div className="mt-3 space-y-1 text-[14px] leading-6 text-[#475467]">
              <div>{order.customerName}</div>
              <div>{order.addressLine1}</div>
              {order.addressLine2 ? <div>{order.addressLine2}</div> : null}
              <div>{order.city}, {order.state} {order.postalCode ?? ""}</div>
              <div>{order.countryCode}</div>
            </div>
          </div>

          <div className="mt-5 rounded-[18px] bg-[#fff7ef] px-4 py-4 ring-1 ring-[#f1ddcd]">
            <div className="flex items-center gap-2 text-[15px] font-semibold text-[#1f2937]">
              <Truck className="h-4 w-4 text-[#d85300]" />
              Exécution fournisseur
            </div>
            <p className="mt-2 text-[13px] leading-6 text-[#6b5a4d]">
              Les achats fournisseurs utilisent une adresse interne de réception Zacch Cargo côté serveur. L'adresse client ci-dessus reste uniquement la destination finale visible en back-office.
            </p>
          </div>
        </article>

        <article className="rounded-[20px] border border-[#e6eaf0] bg-white px-5 py-5 shadow-[0_8px_22px_rgba(17,24,39,0.05)]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-[18px] font-bold text-[#1f2937]">
              <Package2 className="h-5 w-5 text-[#ff6a5b]" />
              Articles commandés
            </div>
            <div className="text-[18px] font-black tracking-[-0.04em] text-[#1f2937]">{pricing.formatPrice(order.totalPriceFcfa / 610)}</div>
          </div>

          <div className="mt-5 space-y-3">
            {order.items.map((item) => (
              <div key={`${order.id}-${item.slug}`} className="rounded-[18px] bg-[#fafbfd] px-4 py-4 ring-1 ring-[#edf1f6]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-[16px] font-semibold text-[#1f2937]">{item.title}</div>
                    <div className="mt-1 text-[13px] leading-6 text-[#667085]">Quantité {item.quantity} · {item.weightKg.toFixed(3)} kg · {item.volumeCbm.toFixed(4)} CBM</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[15px] font-semibold text-[#1f2937]">{pricing.formatPrice(item.finalLinePriceFcfa / 610)}</div>
                    <div className="mt-1 text-[12px] text-[#667085]">Unité {pricing.formatPrice(item.finalUnitPriceFcfa / 610)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}