import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { InternalPageShell } from "@/components/internal-page-shell";
import { getCatalogCategories } from "@/lib/catalog-category-service";
import { getCatalogProductBySlug, getCatalogRelatedProducts } from "@/lib/catalog-service";
import { formatTierAwarePrice } from "@/lib/product-price-display";
import { getPricingContext } from "@/lib/pricing";
import { normalizeStorefrontBadge, normalizeStorefrontText } from "@/lib/public-storefront";
import { PRODUCT_SHARE_IMAGE_PATH, SITE_NAME, SITE_URL, resolveSiteAssetUrl } from "@/lib/site-config";

import { ProductDetailClient } from "./product-detail-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function resolveProductMetaDescription(product: NonNullable<Awaited<ReturnType<typeof getCatalogProductBySlug>>>) {
  const description = typeof product.description === "string" ? product.description.trim() : "";
  if (description) {
    return description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }

  return product.overview.join(" ");
}

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

  const shareImage = resolveSiteAssetUrl(product.image || product.gallery[0], PRODUCT_SHARE_IMAGE_PATH);
  const metaDescription = resolveProductMetaDescription(product);

  return {
    title: `${product.shortTitle} | ${SITE_NAME}`,
    description: metaDescription,
    alternates: {
      canonical: `${SITE_URL}/products/${slug}`,
    },
    openGraph: {
      title: product.shortTitle,
      description: metaDescription,
      url: `${SITE_URL}/products/${slug}`,
      images: [
        {
          url: shareImage,
          alt: product.shortTitle,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: product.shortTitle,
      description: metaDescription,
      images: [shareImage],
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
    moq: entry.moq,
    moqVerified: entry.moqVerified,
    unit: entry.unit,
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
          description: product.description ? normalizeStorefrontText(product.description) : undefined,
          moq: product.moq,
          moqVerified: product.moqVerified,
          packaging: product.packaging,
          packageDimensionsCm: product.packageDimensionsCm,
          itemWeightGrams: product.itemWeightGrams,
          lotCbm: product.lotCbm,
          supplierName: normalizeStorefrontText(product.supplierName),
          supplierLocation: normalizeStorefrontText(product.supplierLocation),
          responseTime: normalizeStorefrontText(product.responseTime),
          yearsInBusiness: product.yearsInBusiness,
          transactionsLabel: normalizeStorefrontText(product.transactionsLabel),
          soldLabel: normalizeStorefrontText(product.soldLabel),
          customizationLabel: normalizeStorefrontText(product.customizationLabel),
          shippingLabel: normalizeStorefrontText(product.shippingLabel),
          gallery: product.gallery,
          videoUrl: product.videoUrl,
          videoPoster: product.videoPoster,
          overview: product.overview.map((entry) => normalizeStorefrontText(entry)),
          sourceUrl: product.sourceUrl,
          reviewSummary: product.reviewSummary,
          reviews: product.reviews,
          tiers: product.tiers.map((tier) => ({
            ...tier,
            formattedPrice: pricing.formatPrice(tier.priceUsd),
          })),
          variantGroups: product.variantGroups,
          variantPricing: product.variantPricing ?? [],
          variantSkus: product.variantSkus ?? [],
          specs: product.specs.map((spec) => ({
            ...spec,
            value: normalizeStorefrontText(spec.value),
          })),
          formattedPriceRange: formatTierAwarePrice(pricing.formatPrice, product),
          badge: normalizeStorefrontBadge(product.badge),
        }}
        relatedProducts={relatedProducts}
        initialIsFavorite={null}
      />
    </InternalPageShell>
  );
}
