import Image from "next/image";
import Link from "next/link";
import { ScrollText, ShieldCheck, Sparkles, WandSparkles, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";

import { CategoryMegaMenu, type CategoryMegaMenuCategory } from "@/components/category-mega-menu";
import { AboutMenu } from "@/components/about-menu";
import { DeliveryAddressPopover } from "@/components/delivery-address-popover";
import { HeaderActionGroup } from "@/components/header-action-group";
import { HomeSearchForm } from "@/components/home-search-form";
import { LanguageSelectorPopover } from "@/components/language-selector-popover";
import { MobileCategoryStrip } from "@/components/mobile-category-strip";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { OrderProtectionMenu } from "@/components/order-protection-menu";
import { ScrollNavbar } from "@/components/scroll-navbar";
import { SiteFooter } from "@/components/site-footer";
import { SupportMenu } from "@/components/support-menu";
import { UnavailableLink } from "@/components/unavailable-link";
import { getCatalogCategories } from "@/lib/catalog-category-service";
import { getCatalogProducts } from "@/lib/catalog-service";
import { getMessages } from "@/lib/messages";
import { getProductImageUrl } from "@/lib/product-image";
import { formatTierAwarePrice, formatTierAwarePriceMeta } from "@/lib/product-price-display";
import { getPricingContext } from "@/lib/pricing";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site-config";
import { getCurrentUser } from "@/lib/user-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const HOME_HERO_NAV_ITEMS: ReadonlyArray<{ label: string; href: string; active?: boolean }> = [
  { label: "Mode", href: "/mode" },
  { label: "Produits", href: "/products", active: true },
  { label: "Tendances", href: "/trends" },
  { label: "Tarifs", href: "/pricing" },
];

const MOBILE_SEARCH_SHORTCUTS: ReadonlyArray<{ label: string; href: string }> = [
  { label: "Mode", href: "/mode" },
  { label: "Devis", href: "/quotes" },
  { label: "Tendances", href: "/trends" },
  { label: "Tarifs", href: "/pricing" },
];

export const metadata: Metadata = {
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
  alternates: {
    canonical: SITE_URL,
  },
};

type QuickAction = {
  title: string;
  icon: LucideIcon;
  href: string;
};

function QuickActionItem({ item }: { item: QuickAction }) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className="flex min-w-0 items-center gap-3 text-left text-[#222] transition-colors hover:text-[#d04a0a]"
    >
      <Icon className="h-6 w-6 shrink-0" />
      <div className="text-[15px] font-semibold">{item.title}</div>
    </Link>
  );
}

export default async function Home() {
  const [pricing, catalogCategories, catalogProducts, user] = await Promise.all([
    getPricingContext(),
    getCatalogCategories(),
    getCatalogProducts(),
    getCurrentUser(),
  ]);
  const messages = getMessages(pricing.languageCode);
  const featuredProducts = catalogProducts.slice(0, 8);
  const megaMenuCategories: CategoryMegaMenuCategory[] = catalogCategories.slice(0, 9).map((category) => ({
    slug: category.slug,
    title: category.title,
    href: category.href,
    products: category.products.slice(0, 5).map((product) => ({
      slug: product.slug,
      shortTitle: product.shortTitle,
      image: getProductImageUrl(product.image, { width: 180, quality: 72 }),
    })),
  }));
  const quickActions: QuickAction[] = [
    {
      title: messages.quickActions.quote,
      icon: ScrollText,
      href: "/quotes",
    },
    {
      title: "Support import",
      icon: ShieldCheck,
      href: "/support-center",
    },
    {
      title: messages.quickActions.quickCustomization,
      icon: WandSparkles,
      href: "/account",
    },
  ];

  return (
    <main className="min-h-screen bg-[#f4f4f4] pb-24 text-[#222] md:pb-0">
      <ScrollNavbar
        countryCode={pricing.countryCode}
        countryLabel={pricing.countryLabel}
        currencyCode={pricing.currency.code}
        flagEmoji={pricing.flagEmoji}
        languageCode={pricing.languageCode}
        languageLabel={pricing.languageLabel}
        user={user ? { displayName: user.displayName, firstName: user.firstName } : null}
        categories={megaMenuCategories}
      />
      <header className="relative z-30 bg-[linear-gradient(180deg,#efd9cf_0%,#f8e7dc_16%,#f4f4f4_100%)]">
        <div className="bg-[#ff6a00] text-white">
          <div className="mx-auto flex max-w-[1580px] items-center justify-between px-4 py-2 text-[11px] sm:px-6 sm:text-[13px] xl:px-10">
            <p className="line-clamp-2 max-w-[78%] leading-4 sm:truncate sm:leading-normal">
              <span className="sm:hidden">AfriPay Marketplace, plateforme de sourcing .</span>
              <span className="hidden sm:inline">{messages.topBar.description}</span>
            </p>
            <span className="hidden font-semibold sm:inline">
              {messages.topBar.supplierOffers}
            </span>
          </div>
        </div>

        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-[-6%] top-24 h-56 w-56 rounded-full bg-white/35 blur-3xl" />
          <div className="absolute left-[18%] top-12 h-32 w-32 rounded-[38%] bg-[#ffb38a]/50 blur-2xl" />
          <div className="absolute right-[8%] top-18 h-72 w-72 rounded-full bg-[#ffd3bc]/70 blur-3xl" />
          <div className="absolute right-[24%] top-28 h-36 w-36 rounded-[32%] bg-white/45 blur-2xl" />
          <div className="absolute left-1/2 top-44 h-20 w-20 -translate-x-1/2 rounded-full bg-[#ff6a00]/10 blur-xl" />
        </div>

        <div className="relative z-20 mx-auto max-w-[1580px] px-4 sm:px-6 xl:px-10">
          <div className="sm:hidden">
            <div className="flex items-center justify-between gap-2 border-b border-black/6 py-3 text-[#2d2621]">
              <LanguageSelectorPopover
                languageCode={pricing.languageCode}
                languageLabel={pricing.languageLabel}
                align="left"
                compact
              />
              <DeliveryAddressPopover
                countryCode={pricing.countryCode}
                countryLabel={pricing.countryLabel}
                currencyCode={pricing.currency.code}
                flagEmoji={pricing.flagEmoji}
                languageCode={pricing.languageCode}
                compact
                align="right"
              />
            </div>

            <div className="py-3.5">
              <Link href="/" className="inline-flex items-center gap-2">
                <div className="text-[28px] font-bold tracking-[-0.06em] text-[#ff6a00]">AfriPay</div>
              </Link>
            </div>
          </div>

          <div className="hidden min-h-[72px] items-center justify-between py-4 sm:flex">
            <Link href="/" className="flex items-center gap-2">
              <div className="text-[24px] font-bold tracking-[-0.05em] text-[#ff6a00] sm:text-[30px]">AfriPay</div>
            </Link>

            <div className="flex flex-wrap items-center gap-3 text-[14px] text-[#222] sm:gap-6">
              <LanguageSelectorPopover
                languageCode={pricing.languageCode}
                languageLabel={pricing.languageLabel}
                align="right"
              />
              <DeliveryAddressPopover
                countryCode={pricing.countryCode}
                countryLabel={pricing.countryLabel}
                currencyCode={pricing.currency.code}
                flagEmoji={pricing.flagEmoji}
                languageCode={pricing.languageCode}
                compact
                align="right"
              />
              <HeaderActionGroup
                className="flex items-center gap-3 text-[#222]"
                iconClassName="h-5 w-5"
                user={user ? { displayName: user.displayName, firstName: user.firstName } : null}
              />
            </div>
          </div>

          <div className="border-t border-black/6">
            <div className="py-3 text-[14px]">
              <div className="mb-3 sm:hidden">
                <MobileCategoryStrip allLabel="Tous" categories={catalogCategories.map((category) => ({ label: category.title, href: category.href }))} />
              </div>

              <nav className="mb-4 grid grid-cols-4 gap-3 sm:hidden">
                {MOBILE_SEARCH_SHORTCUTS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="inline-flex h-12 min-w-0 items-center justify-center rounded-[18px] bg-white/95 px-2 text-center text-[12px] font-semibold text-[#2b221c] shadow-[0_8px_18px_rgba(17,24,39,0.04)] ring-1 ring-black/4 transition hover:text-[#ff6a00]"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>

              <div className="hidden xl:flex xl:flex-row xl:items-center xl:justify-between">
                <nav className="flex flex-wrap items-center gap-x-7 gap-y-2 text-[#222]">
                  <CategoryMegaMenu
                    categories={megaMenuCategories}
                    languageCode={pricing.languageCode}
                    triggerClassName="inline-flex items-center gap-2 py-1 font-semibold"
                    panelClassName="top-[calc(100%+12px)]"
                    widthClassName="w-[1360px]"
                  />
                  <Link href="/pricing" className="font-medium text-[#444] transition hover:text-[#ff6a00]">
                    Tarifs
                  </Link>
                  <OrderProtectionMenu
                    languageCode={pricing.languageCode}
                    triggerClassName="inline-flex items-center py-1 font-medium text-[#444]"
                    panelClassName="top-[calc(100%+12px)]"
                    widthClassName="w-[1120px]"
                  />
                </nav>
                <nav className="flex flex-wrap items-center gap-x-7 gap-y-2 text-[#444]">
                  <AboutMenu triggerLabel={messages.nav.about} className="transition hover:text-[#ff6a00]" align="right" />
                  <SupportMenu triggerLabel={messages.nav.support} className="transition hover:text-[#ff6a00]" />
                  <UnavailableLink
                    label={messages.nav.appExtension}
                    message={messages.unavailable.message}
                    className="text-[#444]"
                    tooltipClassName="left-1/2 top-[calc(100%+12px)] -translate-x-1/2"
                  />
                </nav>
              </div>
            </div>
          </div>

          <div className="flex min-h-[248px] items-start justify-center py-4 sm:min-h-[360px] sm:items-center sm:py-10">
            <div className="w-full max-w-[960px]">
              <nav className="mb-7 hidden items-center justify-center gap-14 xl:flex">
                {HOME_HERO_NAV_ITEMS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group relative inline-flex -translate-y-0 items-center justify-center pb-4 text-[28px] font-black tracking-[-0.06em] text-[#1f2430] transition duration-300 ease-out hover:-translate-y-1 hover:text-[#111]"
                  >
                    <span>{item.label}</span>
                    <span
                      className={[
                        "absolute bottom-0 left-1/2 h-[5px] -translate-x-1/2 rounded-full bg-[#ff6a00] shadow-[0_6px_18px_rgba(255,106,0,0.28)] transition-all duration-300 ease-out",
                        item.active ? "w-16 opacity-100 group-hover:w-20" : "w-0 opacity-0 group-hover:w-16 group-hover:opacity-100",
                      ].join(" ")}
                    />
                  </Link>
                ))}
              </nav>
              <HomeSearchForm
                defaultQuery=""
                placeholderText="Rechercher des produits"
                imageSearchLabel={messages.searchBox.imageSearch}
                searchLabel={messages.common.search}
              />
            </div>
          </div>
        </div>
      </header>

      <section className="relative z-0 border-t border-black/6 bg-white">
        <div className="mx-auto flex max-w-[1800px] flex-col gap-4 px-4 py-5 lg:flex-row lg:items-center lg:justify-between lg:px-10 lg:py-8 xl:px-14">
          <h2 className="text-[26px] font-bold tracking-[-0.04em] text-[#222]">
            {messages.welcome.title}
          </h2>
          <div className="grid gap-2.5 text-[#222] sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center lg:gap-5 lg:justify-end">
            {quickActions.map((item, index) => (
              <div key={item.title} className="flex items-center gap-4 rounded-[18px] bg-white px-3 py-3 ring-1 ring-black/5 lg:bg-transparent lg:px-0 lg:py-0 lg:ring-0">
                {index > 0 ? <span className="hidden h-8 w-px bg-[#d8d8d8] lg:block" /> : null}
                <QuickActionItem item={item} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1580px] px-4 pb-14 pt-5 sm:px-6 sm:pt-8 xl:px-10">
        {featuredProducts.length === 0 ? (
          <section className="rounded-[28px] bg-white px-6 py-8 text-center shadow-[0_12px_36px_rgba(24,39,75,0.06)] ring-1 ring-black/5 sm:px-8 sm:py-10">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#fff2e9] px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#d85300]">
              <Sparkles className="h-4 w-4" />
              Catalogue en attente
            </div>
            <h2 className="mt-4 text-[30px] font-bold tracking-[-0.05em] text-[#222] sm:text-[38px]">Pas d&apos;articles pour le moment</h2>
            <p className="mx-auto mt-3 max-w-[760px] text-[15px] leading-7 text-[#666]">
              Aucun produit publie n&apos;est encore disponible. Publie les imports depuis l&apos;admin sourcing pour les faire apparaitre ici.
            </p>
          </section>
        ) : (
          <section className="rounded-[28px] bg-white px-6 py-8 shadow-[0_12px_36px_rgba(24,39,75,0.06)] ring-1 ring-black/5 sm:px-8 sm:py-10">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-[#fff2e9] px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#d85300]">
                  <Sparkles className="h-4 w-4" />
                  Catalogue public
                </div>
                <h2 className="mt-4 text-[30px] font-bold tracking-[-0.05em] text-[#222] sm:text-[38px]">Produits deja publies</h2>
                <p className="mt-3 max-w-[760px] text-[15px] leading-7 text-[#666]">
                  Les derniers produits importes et publies apparaissent directement sur l&apos;accueil et dans le catalogue.
                </p>
              </div>
              <Link href="/products" className="inline-flex h-11 items-center justify-center rounded-full bg-[#111827] px-5 text-[14px] font-semibold text-white transition hover:bg-[#1f2937]">
                Voir tout le catalogue
              </Link>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {featuredProducts.slice(0, 4).map((product) => (
                <Link
                  key={product.slug}
                  href={`/products/${product.slug}`}
                  className="rounded-[24px] border border-[#edf1f6] bg-[#fcfcfc] p-4 transition hover:-translate-y-0.5 hover:border-[#ffd3bc]"
                >
                  <div className="aspect-[4/3] overflow-hidden rounded-[18px] bg-[#f5f5f5]">
                    <Image
                      src={getProductImageUrl(product.image, { width: 640, quality: 76 })}
                      alt={product.shortTitle}
                      width={640}
                      height={480}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="mt-4 line-clamp-2 text-[17px] font-semibold tracking-[-0.04em] text-[#222]">{product.shortTitle}</div>
                  <div className="mt-2 text-[13px] text-[#667085]">{product.supplierName} · MOQ {product.moq} {product.unit}</div>
                  <div className="mt-3 text-[18px] font-bold text-[#111827]">{formatTierAwarePrice(pricing.formatPrice, product)}</div>
                  {formatTierAwarePriceMeta(product) ? <div className="mt-1 text-[12px] text-[#98a2b3]">{formatTierAwarePriceMeta(product)}</div> : null}
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>

      <SiteFooter pricing={{ ...pricing, shippingWindow: undefined }} />
      <MobileBottomNav />
    </main>
  );
}
