import type { Metadata } from "next";

import { cookies, headers } from "next/headers";

import { FreeDealPageClient } from "@/components/free-deal-page-client";
import { InternalPageShell } from "@/components/internal-page-shell";
import { getUserDefaultAddress } from "@/lib/customer-data-store";
import { FREE_DEAL_DEVICE_COOKIE } from "@/lib/free-deal-constants";
import { resolveRequestIp, resolveRequestOrigin } from "@/lib/free-deal-service";
import { buildFreeDealShareUrl, getFreeDealAccessState, getFreeDealConfig, getFreeDealProducts } from "@/lib/free-deal-store";
import { getPricingContext } from "@/lib/pricing";
import { getProductImageUrl } from "@/lib/product-image";
import { getCurrentUser } from "@/lib/user-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Articles gratuits | AfriPay",
    description: "Selectionnez vos articles de la campagne et reglez un forfait unique pour valider le lot.",
  };
}

function formatEuro(amount: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
}

export default async function FreeDealPage() {
  const [pricing, config, user, cookieStore, headerStore] = await Promise.all([
    getPricingContext(),
    getFreeDealConfig(),
    getCurrentUser(),
    cookies(),
    headers(),
  ]);
  const defaultAddress = user ? await getUserDefaultAddress(user.id).catch(() => undefined) : undefined;
  const deviceId = cookieStore.get(FREE_DEAL_DEVICE_COOKIE)?.value ?? undefined;
  const ip = resolveRequestIp(headerStore);
  const userAgent = headerStore.get("user-agent");
  const [products, access] = await Promise.all([
    getFreeDealProducts(config),
    getFreeDealAccessState({
      deviceId,
      ip,
      userAgent,
      userId: user?.id,
      customerEmail: user?.email,
    }, config),
  ]);
  const origin = resolveRequestOrigin(headerStore);
  const compareAtBase = Number((config.fixedPriceEur * config.compareAtMultiplier + config.compareAtExtraEur).toFixed(2));
  const initialCustomer = {
    customerName: defaultAddress?.recipientName ?? user?.displayName ?? "",
    customerEmail: defaultAddress?.email ?? user?.email ?? "",
    customerPhone: defaultAddress?.phone ?? "",
    addressLine1: defaultAddress?.addressLine1 ?? "",
    addressLine2: defaultAddress?.addressLine2 ?? "",
    city: defaultAddress?.city ?? "",
    state: defaultAddress?.state ?? "",
    postalCode: defaultAddress?.postalCode ?? "",
    countryCode: defaultAddress?.countryCode ?? pricing.countryCode,
    hasDefaultAddress: Boolean(defaultAddress),
  };

  return (
    <InternalPageShell pricing={pricing}>
      <FreeDealPageClient
        config={{
          pageTitle: config.pageTitle,
          heroBadge: config.heroBadge,
          heroTitle: config.heroTitle,
          heroSubtitle: config.heroSubtitle,
          bannerText: config.bannerText,
          ctaLabel: config.ctaLabel,
          shareTitle: config.shareTitle,
          shareDescription: config.shareDescription,
          itemLimit: config.itemLimit,
          fixedPriceLabel: formatEuro(config.fixedPriceEur),
          referralGoal: config.referralGoal,
          dealTagText: config.dealTagText,
        }}
        access={{
          status: access.status,
          referralVisitCount: access.referralVisitCount,
          referralGoal: access.referralGoal,
          shareUrl: access.sharePath ? buildFreeDealShareUrl(origin, access.claim?.referralCode ?? "") : undefined,
          referralCode: access.claim?.referralCode,
        }}
        initialCustomer={initialCustomer}
        products={products.map((product) => ({
          slug: product.slug,
          title: product.shortTitle,
          image: getProductImageUrl(product.image, { width: 720, quality: 78 }),
          supplierName: product.supplierName,
          href: `/products/${product.slug}`,
          compareAtLabel: formatEuro(compareAtBase),
          freeLabel: formatEuro(0),
          tagText: config.dealTagText,
          badgeText: config.productBadgeText,
        }))}
      />
    </InternalPageShell>
  );
}
