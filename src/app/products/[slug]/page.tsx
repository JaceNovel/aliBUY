import { notFound } from "next/navigation";

import { ProductDetailClient } from "@/app/products/[slug]/product-detail-client";
import { InternalPageShell } from "@/components/internal-page-shell";
import { getProductBySlug, getRelatedProducts, products } from "@/lib/products-data";
import { getPricingContext } from "@/lib/pricing";

function formatPriceRange(
  formatPrice: (amountUsd: number) => string,
  minUsd: number,
  maxUsd?: number,
) {
  if (typeof maxUsd === "number") {
    return `${formatPrice(minUsd)} - ${formatPrice(maxUsd)}`;
  }

  return formatPrice(minUsd);
}

export function generateStaticParams() {
  return products.map((product) => ({ slug: product.slug }));
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const pricing = await getPricingContext();
  const { slug } = await params;
  const product = getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const relatedProducts = getRelatedProducts(product.slug).map((relatedProduct) => ({
    slug: relatedProduct.slug,
    title: relatedProduct.shortTitle,
    image: relatedProduct.image,
    formattedPrice: formatPriceRange(pricing.formatPrice, relatedProduct.minUsd, relatedProduct.maxUsd),
    moqLabel: `MOQ: ${relatedProduct.moq} ${relatedProduct.unit}`,
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
          moq: product.moq,
          packaging: product.packaging,
          itemWeightGrams: product.itemWeightGrams,
          lotCbm: product.lotCbm,
          supplierName: product.supplierName,
          supplierLocation: product.supplierLocation,
          responseTime: product.responseTime,
          yearsInBusiness: product.yearsInBusiness,
          transactionsLabel: product.transactionsLabel,
          soldLabel: product.soldLabel,
          customizationLabel: product.customizationLabel,
          shippingLabel: product.shippingLabel,
          gallery: product.gallery,
          videoUrl: product.videoUrl,
          videoPoster: product.videoPoster,
          overview: product.overview,
          tiers: product.tiers.map((tier) => ({
            quantityLabel: tier.quantityLabel,
            priceUsd: tier.priceUsd,
            formattedPrice: pricing.formatPrice(tier.priceUsd),
            note: tier.note,
          })),
          variantGroups: product.variantGroups,
          specs: product.specs,
          formattedPriceRange: formatPriceRange(pricing.formatPrice, product.minUsd, product.maxUsd),
          moqLabel: `MOQ: ${product.moq} ${product.unit}`,
          badge: product.badge,
        }}
        relatedProducts={relatedProducts}
      />
    </InternalPageShell>
  );
}