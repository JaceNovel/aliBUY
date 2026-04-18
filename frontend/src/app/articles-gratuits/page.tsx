import type { Metadata } from "next";

import { cookies, headers } from "next/headers";

import { FreeDealPageClient } from "@/components/free-deal-page-client";
import { InternalPageShell } from "@/components/internal-page-shell";
import { buildApiUrl } from "@/lib/api";
import { getUserDefaultAddress } from "@/lib/customer-data-store";
import { FREE_DEAL_DEVICE_COOKIE } from "@/lib/free-deal-constants";
import { resolveRequestIp, resolveRequestOrigin } from "@/lib/free-deal-service";
import { buildFreeDealShareUrl, getFreeDealAccessState, getFreeDealConfig, getFreeDealProducts, getPurchasedFreeDealProductSlugs } from "@/lib/free-deal-store";
import { getPricingContext } from "@/lib/pricing";
import { CURRENCY_CONFIG } from "@/lib/pricing-options";
import { getProductImageUrl } from "@/lib/product-image";
import type { ProductCatalogItem } from "@/lib/products-data";
import { getCurrentUser } from "@/lib/user-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Articles gratuits | AfriPay",
    description: "Selectionnez vos articles de la campagne et reglez un forfait unique pour valider le lot.",
  };
}

function convertCurrencyAmountToUsd(amount: number, currencyRateFromUsd: number) {
  return amount / currencyRateFromUsd;
}

type FreeDealPageState = {
  config: Awaited<ReturnType<typeof getFreeDealConfig>>;
  products: ProductCatalogItem[];
  claimedProductSlugs: string[];
  access: {
    status: "disabled" | "eligible" | "blocked" | "unlocked";
    referralVisitCount: number;
    referralGoal: number;
    sharePath: string | null;
    referralCode?: string;
  };
};

function buildForwardHeaders(headerStore: Headers, cookieStore: Awaited<ReturnType<typeof cookies>>) {
  const forwarded = new Headers();
  const cookieHeader = cookieStore.toString();

  if (cookieHeader) {
    forwarded.set("cookie", cookieHeader);
  }

  for (const headerName of ["user-agent", "x-forwarded-for", "x-real-ip", "x-vercel-ip-country", "cf-ipcountry", "cloudfront-viewer-country", "x-country-code"]) {
    const value = headerStore.get(headerName);
    if (value) {
      forwarded.set(headerName, value);
    }
  }

  return forwarded;
}

async function loadFreeDealPageState(headerStore: Headers, cookieStore: Awaited<ReturnType<typeof cookies>>) {
  try {
    const response = await fetch(buildApiUrl("/api/free-deals/state"), {
      cache: "no-store",
      headers: buildForwardHeaders(headerStore, cookieStore),
    });

    if (response.ok) {
      const payload = await response.json() as FreeDealPageState;
      if (payload.products.length > 0 || payload.config.productSlugs.length > 0 || payload.access.status !== "disabled") {
        return payload;
      }
    }
  } catch {
    // Fall back to local stores when the API host is unreachable.
  }

  return null;
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
  const remoteState = await loadFreeDealPageState(headerStore, cookieStore);
  const [products, access, resolvedConfig, claimedProductSlugs] = remoteState
    ? [remoteState.products, remoteState.access, remoteState.config, remoteState.claimedProductSlugs]
    : await Promise.all([
        getFreeDealProducts(config),
        getFreeDealAccessState({
          deviceId,
          ip,
          userAgent,
          userId: user?.id,
          customerEmail: user?.email,
        }, config),
        Promise.resolve(config),
        getPurchasedFreeDealProductSlugs(),
      ]);
  const claimedSlugSet = new Set(claimedProductSlugs);
  const origin = resolveRequestOrigin(headerStore);
  const compareAtBase = Number((resolvedConfig.fixedPriceEur * resolvedConfig.compareAtMultiplier + resolvedConfig.compareAtExtraEur).toFixed(2));
  const fixedPriceLabel = pricing.formatPrice(convertCurrencyAmountToUsd(resolvedConfig.fixedPriceEur, CURRENCY_CONFIG.EUR.rateFromUsd));
  const compareAtLabel = pricing.formatPrice(convertCurrencyAmountToUsd(compareAtBase, CURRENCY_CONFIG.EUR.rateFromUsd));
  const shippingFromLabel = pricing.formatPrice(convertCurrencyAmountToUsd(15000, CURRENCY_CONFIG.XOF.rateFromUsd));
  const referralCode = "claim" in access ? access.claim?.referralCode : access.referralCode;
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
          pageTitle: resolvedConfig.pageTitle,
          heroBadge: resolvedConfig.heroBadge,
          heroTitle: resolvedConfig.heroTitle,
          heroSubtitle: resolvedConfig.heroSubtitle,
          bannerText: resolvedConfig.bannerText,
          ctaLabel: resolvedConfig.ctaLabel,
          shareTitle: resolvedConfig.shareTitle,
          shareDescription: resolvedConfig.shareDescription,
          itemLimit: resolvedConfig.itemLimit,
          fixedPriceLabel,
          referralGoal: resolvedConfig.referralGoal,
          dealTagText: resolvedConfig.dealTagText,
          shippingFromLabel,
        }}
        access={{
          status: access.status,
          referralVisitCount: access.referralVisitCount,
          referralGoal: access.referralGoal,
          shareUrl: access.sharePath && referralCode ? buildFreeDealShareUrl(origin, referralCode) : undefined,
          referralCode,
        }}
        initialCustomer={initialCustomer}
        products={products.map((product) => ({
          slug: product.slug,
          title: product.shortTitle,
          image: getProductImageUrl(product.image, { width: 720, quality: 78 }),
          supplierName: product.supplierName,
          href: `/products/${product.slug}`,
          compareAtLabel,
          freeLabel: pricing.formatPrice(0),
          tagText: resolvedConfig.dealTagText,
          badgeText: resolvedConfig.productBadgeText,
          alreadyPurchased: claimedSlugSet.has(product.slug),
        }))}
      />
    </InternalPageShell>
  );
}
