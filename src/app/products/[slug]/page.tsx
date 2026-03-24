import { notFound } from "next/navigation";

import { ProductDetailClient } from "@/app/products/[slug]/product-detail-client";
import { InternalPageShell } from "@/components/internal-page-shell";
import { getCatalogProductBySlug, getCatalogProducts, getCatalogRelatedProducts } from "@/lib/catalog-service";
import { formatTierAwarePrice } from "@/lib/product-price-display";
import { getPricingContext } from "@/lib/pricing";
import { getCurrentUser } from "@/lib/user-auth";
import { isUserFavoriteProduct } from "@/lib/customer-data-store";

export async function generateStaticParams() {
  const products = await getCatalogProducts();
  return products.map((product) => ({ slug: product.slug }));
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const pricing = await getPricingContext();
  const user = await getCurrentUser();
  const { slug } = await params;
  const product = await getCatalogProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const relatedProducts = (await getCatalogRelatedProducts(product.slug)).map((relatedProduct) => ({
    slug: relatedProduct.slug,
    title: relatedProduct.shortTitle,
    image: relatedProduct.image,
    formattedPrice: formatTierAwarePrice(pricing.formatPrice, relatedProduct),
    moqLabel: relatedProduct.moqVerified ? `MOQ: ${relatedProduct.moq} ${relatedProduct.unit}` : "MOQ fournisseur a confirmer",
  }));
  const initialIsFavorite = user ? await isUserFavoriteProduct(user.id, product.slug) : false;

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
          moqVerified: product.moqVerified,
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
          variantPricing: (product.variantPricing ?? []).map((rule) => ({
            selections: rule.selections,
            priceUsd: rule.priceUsd,
            minimumQuantity: rule.minimumQuantity,
            maximumQuantity: rule.maximumQuantity,
            quantityLabel: rule.quantityLabel,
            note: rule.note,
          })),
          specs: product.specs,
          formattedPriceRange: formatTierAwarePrice(pricing.formatPrice, product),
          moqLabel: product.moqVerified ? `MOQ: ${product.moq} ${product.unit}` : "MOQ fournisseur a confirmer",
          badge: product.badge,
        }}
        relatedProducts={relatedProducts}
        initialIsFavorite={initialIsFavorite}
      />
    </InternalPageShell>
  );
}