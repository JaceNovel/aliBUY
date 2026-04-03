import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { InternalPageShell } from "@/components/internal-page-shell";
import { getCatalogCategories } from "@/lib/catalog-category-service";
import { getCatalogProductBySlug, getCatalogRelatedProducts } from "@/lib/catalog-service";
import { formatTierAwarePrice } from "@/lib/product-price-display";
import { getPricingContext } from "@/lib/pricing";
import { normalizeStorefrontBadge, normalizeStorefrontText } from "@/lib/public-storefront";
import { SITE_NAME, SITE_URL } from "@/lib/site-config";

import { ProductDetailClient } from "./product-detail-client";

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function resolveAliExpressSourceUrl(product: { slug: string; rawPayload?: unknown }) {
  const payload = product.rawPayload;
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const detail = record.detail && typeof record.detail === "object" ? record.detail as Record<string, unknown> : null;
    const search = record.search && typeof record.search === "object" ? record.search as Record<string, unknown> : null;

    const detailBaseInfo = detail?.ae_item_base_info_dto && typeof detail.ae_item_base_info_dto === "object"
      ? detail.ae_item_base_info_dto as Record<string, unknown>
      : null;

    const detailUrl = getString(detailBaseInfo?.product_detail_url)
      ?? getString(detailBaseInfo?.detail_url)
      ?? getString(search?.item_detail_url)
      ?? getString(search?.detail_url)
      ?? getString(search?.product_detail_url)
      ?? getString(search?.productUrl)
      ?? getString(search?.product_url);

    if (detailUrl) {
      return detailUrl;
    }
  }

  return /^\d{12,20}$/.test(product.slug) ? `https://www.aliexpress.com/item/${product.slug}.html` : undefined;
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getCatalogProductBySlug(slug);

  if (!product) {
    return {
      title: `Produit introuvable | ${SITE_NAME}`,
      alternates: {
        canonical: `${SITE_URL}/products/${slug}`,
      },
    };
  }

  return {
    title: `${product.shortTitle} | ${SITE_NAME}`,
    description: product.overview.join(" "),
    alternates: {
      canonical: `${SITE_URL}/products/${slug}`,
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [pricing, product, categories] = await Promise.all([
    getPricingContext(),
    getCatalogProductBySlug(slug),
    getCatalogCategories(),
  ]);

  if (!product) {
    notFound();
  }

  const productCategory = categories.find((category) => category.productSlugs.includes(product.slug)) ?? null;

  const relatedProducts = (await getCatalogRelatedProducts(product.slug, 4)).map((entry) => ({
    slug: entry.slug,
    title: entry.shortTitle,
    image: entry.image,
    formattedPrice: formatTierAwarePrice(pricing.formatPrice, entry),
  }));

  return (
    <InternalPageShell pricing={pricing}>
      <ProductDetailClient
        product={{
          slug: product.slug,
          title: product.title,
          shortTitle: product.shortTitle,
          locale: pricing.locale,
          currencyCode: pricing.currency.code,
          countryCode: pricing.countryCode,
          categoryTitle: productCategory?.title ?? "Catalogue AfriPay+",
          moq: product.moq,
          moqVerified: product.moqVerified,
          packaging: product.packaging,
          packageDimensionsCm: product.packageDimensionsCm,
          itemWeightGrams: product.itemWeightGrams,
          lotCbm: product.lotCbm,
          supplierName: normalizeStorefrontText(product.supplierName),
          supplierLocation: product.supplierLocation,
          responseTime: normalizeStorefrontText(product.responseTime),
          yearsInBusiness: product.yearsInBusiness,
          transactionsLabel: normalizeStorefrontText(product.transactionsLabel),
          soldLabel: normalizeStorefrontText(product.soldLabel),
          customizationLabel: normalizeStorefrontText(product.customizationLabel),
          shippingLabel: product.shippingLabel,
          gallery: product.gallery,
          videoUrl: product.videoUrl,
          videoPoster: product.videoPoster,
          overview: product.overview.map((entry) => normalizeStorefrontText(entry)),
          tiers: product.tiers.map((tier) => ({
            ...tier,
            formattedPrice: pricing.formatPrice(tier.priceUsd),
          })),
          variantGroups: product.variantGroups,
          variantPricing: product.variantPricing ?? [],
          specs: product.specs.map((spec) => ({
            ...spec,
            value: normalizeStorefrontText(spec.value),
          })),
          formattedPriceRange: formatTierAwarePrice(pricing.formatPrice, product),
          badge: normalizeStorefrontBadge(product.badge),
          sourceUrl: resolveAliExpressSourceUrl(product),
        }}
        relatedProducts={relatedProducts}
        initialIsFavorite={null}
      />
    </InternalPageShell>
  );
}
