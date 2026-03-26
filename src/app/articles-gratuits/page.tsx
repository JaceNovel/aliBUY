import type { Metadata } from "next";
import { cookies, headers } from "next/headers";

import { FreeDealPageClient } from "@/components/free-deal-page-client";
import { InternalPageShell } from "@/components/internal-page-shell";
import { getUserDefaultAddress } from "@/lib/customer-data-store";
import { calculateFreeDealCompareAtUsd, formatFreeDealEuro } from "@/lib/free-deal";
import { FREE_DEAL_DEVICE_COOKIE } from "@/lib/free-deal-constants";
import { resolveRequestIp, resolveRequestOrigin } from "@/lib/free-deal-service";
import { buildFreeDealShareUrl, getFreeDealAccessState, getFreeDealConfig, getFreeDealProducts } from "@/lib/free-deal-store";
import { getPricingContext } from "@/lib/pricing";
import { getCurrentUser } from "@/lib/user-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
  const config = await getFreeDealConfig();

  return {
    title: `${config.pageTitle} | AfriPay`,
    description: config.heroSubtitle,
    openGraph: {
      title: config.heroTitle,
      description: config.heroSubtitle,
    },
  };
}

export default async function FreeDealPage() {
  const [pricing, config, cookieStore, headerStore, user] = await Promise.all([
    getPricingContext(),
    getFreeDealConfig(),
    cookies(),
    headers(),
    getCurrentUser(),
  ]);
  const defaultAddress = user?.id ? await getUserDefaultAddress(user.id).catch(() => undefined) : undefined;
  const products = await getFreeDealProducts(config);

  const deviceId = cookieStore.get(FREE_DEAL_DEVICE_COOKIE)?.value ?? null;
  const ip = resolveRequestIp(headerStore);
  const userAgent = headerStore.get("user-agent");
  const access = await getFreeDealAccessState({
    deviceId,
    ip,
    userAgent,
    userId: user?.id,
    customerEmail: user?.email,
  }, config);
  const origin = resolveRequestOrigin(headerStore);
  const accessStatus = products.length === 0 ? "disabled" : access.status;

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
          fixedPriceLabel: formatFreeDealEuro(config.fixedPriceEur, pricing.locale),
          referralGoal: config.referralGoal,
          dealTagText: config.dealTagText,
        }}
        access={{
          status: accessStatus,
          referralVisitCount: access.referralVisitCount,
          referralGoal: access.referralGoal,
          referralCode: access.claim?.referralCode,
          shareUrl: access.claim ? buildFreeDealShareUrl(origin, access.claim.referralCode) : undefined,
        }}
        initialCustomer={{
          customerName: user?.displayName || defaultAddress?.recipientName || "",
          customerEmail: user?.email || defaultAddress?.email || "",
          customerPhone: defaultAddress?.phone || "",
          addressLine1: defaultAddress?.addressLine1 || "",
          addressLine2: defaultAddress?.addressLine2 || "",
          city: defaultAddress?.city || "",
          state: defaultAddress?.state || "",
          postalCode: defaultAddress?.postalCode || "",
          countryCode: defaultAddress?.countryCode || "FR",
          hasDefaultAddress: Boolean(defaultAddress),
        }}
        products={products.map((product) => ({
          slug: product.slug,
          title: product.shortTitle,
          image: product.image,
          supplierName: product.supplierName,
          href: `/products/${product.slug}`,
          compareAtLabel: pricing.formatPrice(calculateFreeDealCompareAtUsd(product.minUsd, config)),
          freeLabel: pricing.formatPrice(0),
          tagText: config.dealTagText,
          badgeText: config.productBadgeText,
        }))}
      />
    </InternalPageShell>
  );
}
