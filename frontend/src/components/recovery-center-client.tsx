"use client";

import Link from "next/link";
import { Clock3, Heart, Package, ReceiptText, ShoppingCart, Truck } from "lucide-react";
import { useState } from "react";

type ReminderProduct = {
  slug: string;
  title: string;
  image?: string;
  price?: string;
  viewedAt: string;
};

type RecoveryCenterClientProps = {
  activeCart: {
    itemCount: number;
    lastActivityAt: string;
  } | null;
  activeQuote: {
    productName: string;
    quantity: string;
    shippingWindow: string;
    updatedAt: string;
  } | null;
  pendingPaymentOrders: Array<{
    id: string;
    title: string;
    total: string;
  }>;
  inTransitOrders: Array<{
    id: string;
    title: string;
    trackingCode: string;
    status: string;
    lastUpdate: string;
  }>;
  favoriteProducts: Array<{
    slug: string;
    title: string;
    image?: string;
    price?: string;
  }>;
};

const RECENTLY_VIEWED_STORAGE_KEY = "afripay_recently_viewed_products_v1";

function formatRelativeDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Récemment";
  }

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function RecoveryCenterClient({
  activeCart,
  activeQuote,
  pendingPaymentOrders,
  inTransitOrders,
  favoriteProducts,
}: RecoveryCenterClientProps) {
  const [recentProducts] = useState<ReminderProduct[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }

    try {
      const raw = window.localStorage.getItem(RECENTLY_VIEWED_STORAGE_KEY);
      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw) as ReminderProduct[];
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed.filter((item) => item && typeof item.slug === "string").slice(0, 6);
    } catch {
      return [];
    }
  });

  const favoriteSlugSet = new Set(favoriteProducts.map((item) => item.slug));
  const smartReminderProducts = recentProducts.map((item) => ({
    ...item,
    isFavorite: favoriteSlugSet.has(item.slug),
  }));

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-4">
        <article className="rounded-[24px] bg-white px-5 py-5 shadow-[0_12px_32px_rgba(17,24,39,0.06)] ring-1 ring-black/5">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-[16px] bg-[#fff2e8] text-[#ff6a00]">
            <ShoppingCart className="h-5 w-5" />
          </div>
          <div className="mt-4 text-[14px] font-semibold text-[#6b7280]">Panier à reprendre</div>
          <div className="mt-1 text-[28px] font-black tracking-[-0.05em] text-[#111827]">{activeCart?.itemCount ?? 0}</div>
          <p className="mt-2 text-[13px] leading-6 text-[#667085]">
            {activeCart ? `Dernière activité le ${formatRelativeDate(activeCart.lastActivityAt)}.` : "Aucun panier laissé en attente pour le moment."}
          </p>
          <Link href="/cart" className="mt-4 inline-flex text-[14px] font-semibold text-[#2563eb] transition hover:opacity-80">Ouvrir le panier</Link>
        </article>

        <article className="rounded-[24px] bg-white px-5 py-5 shadow-[0_12px_32px_rgba(17,24,39,0.06)] ring-1 ring-black/5">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-[16px] bg-[#eef4ff] text-[#2563eb]">
            <ReceiptText className="h-5 w-5" />
          </div>
          <div className="mt-4 text-[14px] font-semibold text-[#6b7280]">Devis brouillon</div>
          <div className="mt-1 text-[28px] font-black tracking-[-0.05em] text-[#111827]">{activeQuote ? 1 : 0}</div>
          <p className="mt-2 text-[13px] leading-6 text-[#667085]">
            {activeQuote ? `${activeQuote.productName || "Demande devis"} • ${activeQuote.quantity || "Quantité à confirmer"}` : "Aucun devis en attente de reprise."}
          </p>
          <Link href="/quotes" className="mt-4 inline-flex text-[14px] font-semibold text-[#2563eb] transition hover:opacity-80">Reprendre le devis</Link>
        </article>

        <article className="rounded-[24px] bg-white px-5 py-5 shadow-[0_12px_32px_rgba(17,24,39,0.06)] ring-1 ring-black/5">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-[16px] bg-[#fff4ea] text-[#d65d00]">
            <Clock3 className="h-5 w-5" />
          </div>
          <div className="mt-4 text-[14px] font-semibold text-[#6b7280]">Paiements à finaliser</div>
          <div className="mt-1 text-[28px] font-black tracking-[-0.05em] text-[#111827]">{pendingPaymentOrders.length}</div>
          <p className="mt-2 text-[13px] leading-6 text-[#667085]">
            {pendingPaymentOrders[0] ? `${pendingPaymentOrders[0].title} • ${pendingPaymentOrders[0].total}` : "Aucune commande ne demande un paiement immédiat."}
          </p>
          <Link href="/orders" className="mt-4 inline-flex text-[14px] font-semibold text-[#2563eb] transition hover:opacity-80">Voir les commandes</Link>
        </article>

        <article className="rounded-[24px] bg-white px-5 py-5 shadow-[0_12px_32px_rgba(17,24,39,0.06)] ring-1 ring-black/5">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-[16px] bg-[#ecfdf3] text-[#039855]">
            <Truck className="h-5 w-5" />
          </div>
          <div className="mt-4 text-[14px] font-semibold text-[#6b7280]">Commandes en transit</div>
          <div className="mt-1 text-[28px] font-black tracking-[-0.05em] text-[#111827]">{inTransitOrders.length}</div>
          <p className="mt-2 text-[13px] leading-6 text-[#667085]">
            {inTransitOrders[0] ? `${inTransitOrders[0].trackingCode} • ${inTransitOrders[0].status}` : "Aucun colis en transit pour le moment."}
          </p>
          <Link href="/orders/tracking" className="mt-4 inline-flex text-[14px] font-semibold text-[#2563eb] transition hover:opacity-80">Suivre un colis</Link>
        </article>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <article className="rounded-[28px] bg-white px-6 py-6 shadow-[0_14px_34px_rgba(17,24,39,0.06)] ring-1 ring-black/5 sm:px-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#ff6a00]">À relancer</div>
              <h2 className="mt-2 text-[26px] font-black tracking-[-0.05em] text-[#111827]">Produits consultés et favoris chauds</h2>
            </div>
            <Link href="/products" className="text-[14px] font-semibold text-[#2563eb]">Voir le catalogue</Link>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {smartReminderProducts.length === 0 ? (
              <div className="rounded-[18px] bg-[#f8fafc] px-4 py-4 text-[14px] text-[#667085] ring-1 ring-[#e7edf4]">
                Les produits récemment consultés apparaîtront ici avec une relance rapide.
              </div>
            ) : smartReminderProducts.map((item) => (
              <Link key={item.slug} href={`/products/${item.slug}`} className="rounded-[18px] border border-[#e9edf3] bg-[#fcfcfd] px-4 py-4 transition hover:-translate-y-0.5 hover:border-[#ffb37a] hover:bg-white">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="line-clamp-2 text-[15px] font-semibold leading-6 text-[#101828]">{item.title}</div>
                    <div className="mt-2 text-[13px] text-[#667085]">{item.price || "Prix à recalculer"}</div>
                  </div>
                  {item.isFavorite ? <Heart className="h-4 w-4 shrink-0 fill-current text-[#f97316]" /> : <Package className="h-4 w-4 shrink-0 text-[#98a2b3]" />}
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 text-[12px] text-[#98a2b3]">
                  <span>{item.isFavorite ? "Favori à relancer" : "Revoir ce produit"}</span>
                  <span>{formatRelativeDate(item.viewedAt)}</span>
                </div>
              </Link>
            ))}
          </div>
        </article>

        <article className="rounded-[28px] bg-white px-6 py-6 shadow-[0_14px_34px_rgba(17,24,39,0.06)] ring-1 ring-black/5 sm:px-7">
          <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#2563eb]">Actions directes</div>
          <h2 className="mt-2 text-[24px] font-black tracking-[-0.05em] text-[#111827]">Une seule page pour repartir</h2>
          <div className="mt-5 space-y-3">
            <Link href="/quotes" className="flex items-center justify-between rounded-[18px] bg-[#f8fafc] px-4 py-4 text-[15px] font-semibold text-[#111827] ring-1 ring-[#e7edf4] transition hover:bg-white hover:ring-[#d4deea]">
              <span>Reprendre un devis</span>
              <span className="text-[#2563eb]">{activeQuote ? "1 brouillon" : "Nouveau"}</span>
            </Link>
            <Link href="/orders" className="flex items-center justify-between rounded-[18px] bg-[#f8fafc] px-4 py-4 text-[15px] font-semibold text-[#111827] ring-1 ring-[#e7edf4] transition hover:bg-white hover:ring-[#d4deea]">
              <span>Finaliser un paiement</span>
              <span className="text-[#2563eb]">{pendingPaymentOrders.length}</span>
            </Link>
            <Link href="/messages" className="flex items-center justify-between rounded-[18px] bg-[#f8fafc] px-4 py-4 text-[15px] font-semibold text-[#111827] ring-1 ring-[#e7edf4] transition hover:bg-white hover:ring-[#d4deea]">
              <span>Contacter AfriPay</span>
              <span className="text-[#2563eb]">Support direct</span>
            </Link>
            <Link href="/orders/tracking" className="flex items-center justify-between rounded-[18px] bg-[#f8fafc] px-4 py-4 text-[15px] font-semibold text-[#111827] ring-1 ring-[#e7edf4] transition hover:bg-white hover:ring-[#d4deea]">
              <span>Suivre une commande</span>
              <span className="text-[#2563eb]">Timeline</span>
            </Link>
          </div>

          <div className="mt-5 rounded-[18px] bg-[linear-gradient(135deg,#111827_0%,#1f3b63_100%)] px-4 py-4 text-white">
            <div className="text-[13px] font-semibold uppercase tracking-[0.12em] text-white/70">Raccourci utile</div>
            <p className="mt-2 text-[14px] leading-6 text-white/82">
              Dès qu&apos;un panier ou un devis reste en attente, vous retrouvez ici le chemin le plus court pour reprendre et valider.
            </p>
          </div>
        </article>
      </section>
    </div>
  );
}
