import { redirect } from "next/navigation";

import { RecoveryCenterClient } from "@/components/recovery-center-client";
import { InternalPageShell } from "@/components/internal-page-shell";
import { getAbandonedCartRecords } from "@/lib/abandoned-cart-store";
import { getUserAbandonedQuoteRecord } from "@/lib/abandoned-quote-store";
import { getFavoriteRecords, getUserQuoteRequests } from "@/lib/customer-data-store";
import { getCatalogProductsBySlugs } from "@/lib/catalog-service";
import { getUserOrderRecords } from "@/lib/order-service";
import { getPricingContext } from "@/lib/pricing";
import { getCurrentUser } from "@/lib/user-auth";

export default async function SupportCenterPage() {
  const pricing = await getPricingContext();
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?next=/support-center");
  }

  const [orders, quotes, abandonedCarts, abandonedQuote, favoriteRecords] = await Promise.all([
    getUserOrderRecords(user),
    getUserQuoteRequests(user.id),
    getAbandonedCartRecords(),
    getUserAbandonedQuoteRecord(user.id),
    getFavoriteRecords(),
  ]);
  const activeCart = abandonedCarts.find((entry) => entry.userId === user.id && entry.status === "active") ?? null;
  const pendingPaymentOrders = orders.filter((order) => order.status === "Paiement en attente" || order.status === "Expedition en attente");
  const inTransitOrders = orders.filter((order) => order.status === "Livraison en attente");
  const favoriteSlugs = favoriteRecords.filter((entry) => entry.userId === user.id).map((entry) => entry.productSlug);
  const favoriteProducts = await getCatalogProductsBySlugs(favoriteSlugs);

  return (
    <InternalPageShell pricing={pricing}>
      <section className="rounded-[32px] bg-[linear-gradient(135deg,#fff5ee_0%,#ffffff_52%,#f5f9ff_100%)] px-6 py-8 shadow-[0_18px_40px_rgba(17,24,39,0.06)] ring-1 ring-black/5 sm:px-8 sm:py-10">
        <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#ff6a00]">Centre de reprise</div>
        <h1 className="mt-3 text-[34px] font-black tracking-[-0.05em] text-[#1f2937]">Reprenez vos paniers, devis et commandes sans perdre une étape</h1>
        <p className="mt-3 max-w-[860px] text-[15px] leading-7 text-[#667085]">
          Tout ce qui reste ouvert sur votre compte est réuni ici: panier abandonné, devis en attente, paiement à finaliser, colis en transit et produits à relancer.
        </p>
        <div className="mt-5 flex flex-wrap gap-3 text-[13px] font-semibold text-[#694d3b]">
          <span className="rounded-full border border-[#f2d8c5] bg-white px-4 py-2">{quotes.length} devis enregistrés</span>
          <span className="rounded-full border border-[#f2d8c5] bg-white px-4 py-2">{orders.length} commandes visibles</span>
          <span className="rounded-full border border-[#f2d8c5] bg-white px-4 py-2">{favoriteProducts.length} favoris exploitables</span>
        </div>
      </section>

      <div className="mt-6">
        <RecoveryCenterClient
          activeCart={activeCart ? { itemCount: activeCart.itemCount, lastActivityAt: activeCart.lastActivityAt } : null}
          activeQuote={abandonedQuote && abandonedQuote.status === "active"
            ? {
                productName: abandonedQuote.productName,
                quantity: abandonedQuote.quantity,
                shippingWindow: abandonedQuote.shippingWindow,
                updatedAt: abandonedQuote.updatedAt,
              }
            : null}
          pendingPaymentOrders={pendingPaymentOrders.map((order) => ({
            id: order.id,
            title: order.title,
            total: order.total,
          }))}
          inTransitOrders={inTransitOrders.map((order) => ({
            id: order.id,
            title: order.title,
            trackingCode: order.logistics.trackingCode,
            status: order.status,
            lastUpdate: order.logistics.lastUpdate,
          }))}
          favoriteProducts={favoriteProducts.map((product) => ({
            slug: product.slug,
            title: product.shortTitle,
            image: product.image,
            price: pricing.formatPrice(product.tiers[0]?.priceUsd ?? 0),
          }))}
        />
      </div>
    </InternalPageShell>
  );
}
