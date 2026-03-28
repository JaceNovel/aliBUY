import Link from "next/link";
import { ArrowUpRight, ExternalLink } from "lucide-react";
import { notFound } from "next/navigation";

import { getAdminSectionMeta } from "@/lib/admin-config";
import {
  adminEmailCampaigns,
  adminPromoCodes,
  adminSettingsGroups,
  getAdminOrders,
  getAdminImportRequests,
  getAdminOffers,
  getAdminPromotions,
  getAdminRecentOrders,
  getAdminReviews,
  getAdminSuppliers,
  getAdminSupportTickets,
} from "@/lib/admin-data";
import { getCatalogCategories } from "@/lib/catalog-category-service";
import { getCatalogProducts } from "@/lib/catalog-service";

type PricingLike = {
  formatPrice: (amountUsd: number) => string;
};

function formatPriceRange(formatPrice: (amountUsd: number) => string, minUsd: number, maxUsd?: number) {
  if (typeof maxUsd === "number") {
    return `${formatPrice(minUsd)} - ${formatPrice(maxUsd)}`;
  }

  return formatPrice(minUsd);
}

export async function AdminSectionContent({ slug, pricing }: { slug: string; pricing: PricingLike }) {
  const meta = getAdminSectionMeta(slug as never);

  if (!meta) {
    notFound();
  }

  let summaryValue = "";
  let columns: string[] = [];
  let rows: Array<{ key: string; values: string[]; href?: string; actionLabel?: string }> = [];
  const catalogProducts = await getCatalogProducts();

  switch (meta.slug) {
    case "users": {
      const suppliers = await getAdminSuppliers();
      summaryValue = `${suppliers.length} comptes reperes`;
      columns = ["Nom", "Localisation", "Produits", "Reponse", "Statut"];
      rows = suppliers.map((supplier) => ({
        key: supplier.name,
        values: [supplier.name, supplier.location, String(supplier.productCount), supplier.responseTime, supplier.status],
        href: "/products",
      }));
      break;
    }
    case "orders": {
      const orders = await getAdminOrders();
      summaryValue = `${orders.length} commandes enregistrées`;
      columns = ["Commande", "Client", "Livraison", "Paiement", "Total", "Action"];
      rows = orders.map((order) => ({
        key: order.id,
        values: [order.orderNumber, order.customerName, `${order.shippingMethod.toUpperCase()} · ${order.countryCode}`, order.paymentStatus, pricing.formatPrice(order.totalUsd), "Voir"],
        href: order.href,
        actionLabel: "Voir",
      }));
      break;
    }
    case "products": {
      summaryValue = `${catalogProducts.length} references catalogue`;
      columns = ["Produit", "Fournisseur", "Prix", "MOQ", "Badge"];
      rows = catalogProducts.map((product) => ({
        key: product.slug,
        values: [product.shortTitle, product.supplierName, formatPriceRange(pricing.formatPrice, product.minUsd, product.maxUsd), `${product.moq} ${product.unit}`, product.badge ?? "Catalogue"],
        href: `/products/${product.slug}`,
      }));
      break;
    }
    case "categories": {
      const categories = await getCatalogCategories();
      summaryValue = `${categories.length} categories synchronisees`;
      columns = ["Categorie", "Chemin Alibaba", "Produits", "Action"];
      rows = categories.map((category) => ({
        key: category.slug,
        values: [category.title, category.sourcePathLabel, String(category.productCount), "Ouvrir"],
        href: category.href,
        actionLabel: "Ouvrir",
      }));
      break;
    }
    case "promotions": {
      const promotions = await getAdminPromotions();
      summaryValue = `${promotions.length} promotions visibles`;
      columns = ["Promotion", "Badge", "Prix", "Destination"];
      rows = promotions.map((promotion) => ({
        key: promotion.name,
        values: [promotion.name, promotion.badge, formatPriceRange(pricing.formatPrice, promotion.priceMinUsd, promotion.priceMaxUsd), promotion.href],
        href: promotion.href,
      }));
      break;
    }
    case "promo-codes": {
      summaryValue = `${adminPromoCodes.length} codes actifs`;
      columns = ["Code", "Type", "Valeur", "Canal"];
      rows = adminPromoCodes.map((code) => ({
        key: code.code,
        values: [code.code, code.type, code.value, code.channel],
        href: code.href,
      }));
      break;
    }
    case "offers": {
      const offers = await getAdminOffers();
      summaryValue = `${offers.length} offres operationnelles`;
      columns = ["Offre", "Fournisseur", "MOQ", "Prix"];
      rows = offers.map((offer) => ({
        key: offer.name,
        values: [offer.name, offer.supplier, offer.moq, pricing.formatPrice(offer.priceMinUsd)],
        href: offer.href,
      }));
      break;
    }
    case "email": {
      summaryValue = `${adminEmailCampaigns.length} campagnes email`;
      columns = ["Sujet", "Segment", "Statut", "Lien"];
      rows = adminEmailCampaigns.map((campaign) => ({
        key: campaign.subject,
        values: [campaign.subject, campaign.segment, campaign.status, campaign.href],
        href: campaign.href,
      }));
      break;
    }
    case "support": {
      const tickets = await getAdminSupportTickets();
      summaryValue = `${tickets.length} tickets relies aux commandes`;
      columns = ["Sujet", "Agent", "Priorite", "Statut"];
      rows = tickets.map((ticket) => ({
        key: `${ticket.subject}-${ticket.owner}`,
        values: [ticket.subject, ticket.owner, ticket.priority, ticket.status],
        href: ticket.href,
      }));
      break;
    }
    case "imports": {
      const imports = await getAdminImportRequests();
      summaryValue = `${imports.length} dossiers en cours`;
      columns = ["Commande", "Corridor", "Tracking", "Agent"];
      rows = imports.map((entry) => ({
        key: entry.orderId,
        values: [entry.orderId, entry.corridor, entry.tracking, entry.agent],
        href: entry.href,
      }));
      break;
    }
    case "reviews": {
      const reviews = getAdminReviews();
      summaryValue = `${reviews.length} retours produits`;
      columns = ["Produit", "Score", "Resume"];
      rows = reviews.map((review) => ({
        key: review.product,
        values: [review.product, `${review.score}/5`, review.summary],
        href: review.href,
      }));
      break;
    }
    case "settings": {
      summaryValue = `${adminSettingsGroups.length} reglages critiques`;
      columns = ["Bloc", "Detail", "Lien"];
      rows = adminSettingsGroups.map((setting) => ({
        key: setting.label,
        values: [setting.label, setting.detail, setting.href],
        href: setting.href,
      }));
      break;
    }
  }

  const recentOrders = await getAdminRecentOrders(3);

  return (
    <div className="space-y-5">
      <section className="rounded-[20px] border border-[#e6eaf0] bg-white px-5 py-5 shadow-[0_8px_22px_rgba(17,24,39,0.05)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#ff6a5b]">Administration</div>
            <h1 className="mt-2 text-[30px] font-black tracking-[-0.05em] text-[#1f2937]">{meta.label}</h1>
            <p className="mt-2 max-w-[760px] text-[14px] leading-6 text-[#667085]">{meta.description}</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="rounded-[14px] bg-[#fff2ed] px-4 py-3 text-[13px] font-semibold text-[#ff6a5b]">{summaryValue}</div>
            {meta.publicHref ? (
              <Link href={meta.publicHref} className="inline-flex h-10 items-center justify-center gap-2 rounded-[14px] border border-[#e5e7eb] px-4 text-[13px] font-semibold text-[#1f2937] transition hover:border-[#ff6a5b] hover:text-[#ff6a5b]">
                Voir la page publique
                <ExternalLink className="h-4 w-4" />
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <article className="overflow-hidden rounded-[20px] border border-[#e6eaf0] bg-white shadow-[0_8px_22px_rgba(17,24,39,0.05)]">
          <div className="border-b border-[#edf1f6] px-5 py-4 text-[18px] font-bold text-[#1f2937]">Vue detaillee</div>
          <div className="overflow-x-auto px-5 py-3">
            <table className="min-w-full text-left">
              <thead>
                <tr className="text-[12px] uppercase tracking-[0.08em] text-[#98a2b3]">
                  {columns.map((column) => (
                    <th key={column} className="py-3 pr-4 font-semibold">{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key} className="border-t border-[#edf1f6] align-top text-[13px] text-[#1f2937]">
                    {row.values.map((value, index) => (
                      <td key={`${row.key}-${index}`} className="py-3.5 pr-4 leading-6">
                        {row.actionLabel && value === row.actionLabel && row.href ? (
                          <Link href={row.href} className="inline-flex h-9 items-center justify-center rounded-full border border-[#d7dce5] px-4 text-[12px] font-semibold text-[#1f2937] transition hover:border-[#ff6a5b] hover:text-[#ff6a5b]">
                            {value}
                          </Link>
                        ) : value}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <aside className="space-y-4">
          <article className="rounded-[20px] border border-[#e6eaf0] bg-white px-5 py-5 shadow-[0_8px_22px_rgba(17,24,39,0.05)]">
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#ff6a5b]">Action rapide</div>
            <div className="mt-2 text-[22px] font-black tracking-[-0.04em] text-[#1f2937]">Piloter {meta.label.toLowerCase()}</div>
            <p className="mt-2 text-[13px] leading-6 text-[#667085]">Chaque module admin reste relie au projet principal pour passer de la vue gestion a la vue marketplace.</p>
            <div className="mt-4 space-y-2.5">
              <Link href="/admin" className="flex items-center justify-between rounded-[14px] bg-[#f8f9fb] px-4 py-3 text-[13px] font-semibold text-[#1f2937] transition hover:bg-[#fff2ed] hover:text-[#ff6a5b]">
                Retour au dashboard
                <ArrowUpRight className="h-4 w-4" />
              </Link>
              {meta.publicHref ? (
                <Link href={meta.publicHref} className="flex items-center justify-between rounded-[14px] bg-[#f8f9fb] px-4 py-3 text-[13px] font-semibold text-[#1f2937] transition hover:bg-[#fff2ed] hover:text-[#ff6a5b]">
                  Ouvrir la route liee
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              ) : null}
            </div>
          </article>

          <article className="rounded-[20px] border border-[#e6eaf0] bg-white px-5 py-5 shadow-[0_8px_22px_rgba(17,24,39,0.05)]">
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#ff6a5b]">Recent</div>
            <div className="mt-2 text-[20px] font-black tracking-[-0.04em] text-[#1f2937]">Dernieres commandes</div>
            <div className="mt-4 space-y-3">
              {recentOrders.map((order) => (
                <Link key={order.id} href={order.href} className="block rounded-[14px] bg-[#f8f9fb] px-4 py-3 transition hover:bg-[#fff2ed]">
                  <div className="text-[13px] font-bold text-[#1f2937]">{order.id}</div>
                  <div className="mt-1 text-[12px] text-[#667085]">{order.customer}</div>
                  <div className="mt-2 text-[12px] font-medium text-[#1f2937]">{pricing.formatPrice(order.totalUsd)}</div>
                </Link>
              ))}
            </div>
          </article>
        </aside>
      </section>
    </div>
  );
}
