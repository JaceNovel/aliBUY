import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Camera, Clock3, ScrollText, ShieldCheck, Sparkles, WandSparkles, type LucideIcon } from "lucide-react";

import { CategoryMegaMenu, type CategoryMegaMenuCategory } from "@/components/category-mega-menu";
import { AboutMenu } from "@/components/about-menu";
import { DeliveryAddressPopover } from "@/components/delivery-address-popover";
import { HeaderActionGroup } from "@/components/header-action-group";
import { HomeDiscoveryShowcase } from "@/components/home-discovery-showcase";
import { HomeSearchForm } from "@/components/home-search-form";
import { LanguageSelectorPopover } from "@/components/language-selector-popover";
import { MobileCategoryStrip } from "@/components/mobile-category-strip";
import { OrderProtectionMenu } from "@/components/order-protection-menu";
import { ScrollNavbar } from "@/components/scroll-navbar";
import { SupportMenu } from "@/components/support-menu";
import { UnavailableLink } from "@/components/unavailable-link";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { getCatalogCategories } from "@/lib/catalog-category-service";
import { getCatalogProducts } from "@/lib/catalog-service";
import { getMessages } from "@/lib/messages";
import { type ProductCatalogItem } from "@/lib/products-data";
import { formatTierAwarePrice } from "@/lib/product-price-display";
import { getPricingContext } from "@/lib/pricing";

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

type QuickAction = {
  title: string;
  icon: LucideIcon;
  href: string;
};

function ProductCardItem({
  item,
  formatPrice,
  guaranteedLabel,
  moqLabel,
  href,
}: {
  item: ProductCatalogItem;
  formatPrice: (amountUsd: number) => string;
  guaranteedLabel: string;
  moqLabel: string;
  href: string;
}) {
  return (
    <Link href={href} className="group block rounded-[16px] bg-white p-2.5 shadow-[0_1px_0_rgba(0,0,0,0.03),0_10px_30px_rgba(17,24,39,0.05)] ring-1 ring-black/5 transition-transform duration-200 hover:-translate-y-1 hover:shadow-[0_1px_0_rgba(0,0,0,0.03),0_22px_40px_rgba(17,24,39,0.1)] sm:rounded-[20px] sm:p-3">
      <div className="relative overflow-hidden rounded-[13px] bg-[#f5f5f5] sm:rounded-[16px]">
        {item.badge ? (
          <div className="absolute left-2 top-2 z-10 rounded-full bg-[#de0505] px-1.5 py-0.5 text-[9px] font-semibold text-white">
            {item.badge}
          </div>
        ) : null}
        <div className="relative aspect-square w-full">
          <Image
            src={item.image}
            alt={item.title}
            fill
            sizes="(min-width: 1440px) 15vw, (min-width: 1280px) 18vw, (min-width: 640px) 30vw, 48vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        </div>
        <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_68%,rgba(0,0,0,0.04)_100%)]" />
      </div>

      <div className="mt-2.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#d04a0a] sm:mt-3 sm:text-[11px] sm:tracking-[0.14em]">{guaranteedLabel}</div>
      <div className="mt-1.5 line-clamp-2 min-h-[34px] text-[12px] font-medium leading-4 text-[#222] sm:mt-2 sm:min-h-11 sm:text-[15px] sm:leading-5">
        {item.title}
      </div>
      <div className="mt-2.5 flex items-end gap-2 sm:mt-3">
        <div className="whitespace-nowrap text-[13px] font-bold leading-none tracking-[-0.03em] text-[#222] sm:text-[15px] xl:text-[16px]">
          {formatTierAwarePrice(formatPrice, item)}
        </div>
      </div>
      <div className="mt-1 text-[10px] text-[#666] sm:mt-2 sm:text-[12px]">{moqLabel}: {item.moq} {item.unit}</div>
    </Link>
  );
}

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
  const [pricing, catalogProducts, catalogCategories] = await Promise.all([
    getPricingContext(),
    getCatalogProducts(),
    getCatalogCategories(),
  ]);
  const messages = getMessages(pricing.languageCode);
  const megaMenuCategories: CategoryMegaMenuCategory[] = catalogCategories.slice(0, 9).map((category) => ({
    slug: category.slug,
    title: category.title,
    href: category.href,
    products: category.products.slice(0, 5).map((product) => ({
      slug: product.slug,
      shortTitle: product.shortTitle,
      image: product.image,
    })),
  }));
  const historyItems = catalogProducts.slice(0, 5);
  const recommendationProducts = catalogProducts.slice(5, 9).length > 0 ? catalogProducts.slice(5, 9) : catalogProducts.slice(0, 4);
  const discoveryHistoryItems = catalogProducts.slice(0, 4);
  const showcaseProducts = catalogProducts.slice(0, 9);
  const hasPublishedProducts = catalogProducts.length > 0;
  const quickActions: QuickAction[] = [
    {
      title: messages.quickActions.quote,
      icon: ScrollText,
      href: "/quotes",
    },
    {
      title: messages.quickActions.topProducts,
      icon: Camera,
      href: "/favorites",
    },
    {
      title: messages.quickActions.quickCustomization,
      icon: WandSparkles,
      href: "/account",
    },
  ];
  const discoveryExploreCards = [
    {
      id: "latest-imports",
      title: "Nouveaux imports",
      subtitle: "Produits publies apres import Alibaba.",
      items: showcaseProducts.slice(0, 3).map((product) => ({
        title: product.title,
        image: product.image,
        price: pricing.formatPrice(product.minUsd),
        href: `/products/${product.slug}`,
      })),
    },
    {
      id: "catalog-ready",
      title: "Prets pour la vente",
      subtitle: "References visibles sur le site public.",
      items: showcaseProducts.slice(3, 6).map((product) => ({
        title: product.title,
        image: product.image,
        price: pricing.formatPrice(product.minUsd),
        href: `/products/${product.slug}`,
      })),
    },
    {
      id: "recent-publications",
      title: "Dernieres publications",
      subtitle: "Articles importes avec medias et prix actifs.",
      items: showcaseProducts.slice(6, 9).map((product) => ({
        title: product.title,
        image: product.image,
        price: pricing.formatPrice(product.minUsd),
        href: `/products/${product.slug}`,
      })),
    },
  ].filter((group) => group.items.length > 0);
  const discoverySlides: Array<{
    id: string;
    image: string;
    alt: string;
    eyebrow?: string;
    title: string;
    subtitle?: string;
    buttonLabel: string;
    href: string;
  }> = [];
  const recommendationCopy = [
    { eyebrow: "Pour ton sourcing", eta: "Publication recente" },
    { eyebrow: "Catalogue live", eta: "Media et prix actifs" },
    { eyebrow: "Selection publiee", eta: "Pret pour commande" },
    { eyebrow: "Import valide", eta: "Visible sur le site" },
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
              <HeaderActionGroup className="flex items-center gap-3 text-[#222]" iconClassName="h-5 w-5" />
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
        <div className="mx-auto flex max-w-[1800px] flex-col gap-5 px-4 py-6 lg:flex-row lg:items-center lg:justify-between lg:px-10 lg:py-8 xl:px-14">
          <h2 className="text-[26px] font-bold tracking-[-0.04em] text-[#222]">
            {messages.welcome.title}
          </h2>
          <div className="grid gap-3 text-[#222] sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center lg:gap-5 lg:justify-end">
            {quickActions.map((item, index) => (
              <div key={item.title} className="flex items-center gap-5 rounded-[20px] bg-white px-4 py-4 ring-1 ring-black/5 lg:bg-transparent lg:px-0 lg:py-0 lg:ring-0">
                {index > 0 ? <span className="hidden h-8 w-px bg-[#d8d8d8] lg:block" /> : null}
                <QuickActionItem item={item} />
              </div>
            ))}
          </div>
        </div>
      </section>
      <div className="mx-auto max-w-[1580px] px-4 pb-16 pt-6 sm:px-6 sm:pt-8 xl:px-10">
        {hasPublishedProducts ? (
          <HomeDiscoveryShowcase
            historyCard={discoveryHistoryItems[0] ? {
              title: discoveryHistoryItems[0].title,
              image: discoveryHistoryItems[0].image,
              price: pricing.formatPrice(discoveryHistoryItems[0].minUsd),
              href: `/products/${discoveryHistoryItems[0].slug}`,
            } : undefined}
            historyCards={discoveryHistoryItems.map((item) => ({
              title: item.title,
              image: item.image,
              price: pricing.formatPrice(item.minUsd),
              href: `/products/${item.slug}`,
            }))}
            exploreCards={discoveryExploreCards}
            slides={discoverySlides}
          />
        ) : (
          <section className="rounded-[28px] bg-white px-6 py-8 text-center shadow-[0_12px_36px_rgba(24,39,75,0.06)] ring-1 ring-black/5 sm:px-8 sm:py-10">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#fff2e9] px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#d85300]">
              <Sparkles className="h-4 w-4" />
              Catalogue en attente
            </div>
            <h2 className="mt-4 text-[30px] font-bold tracking-[-0.05em] text-[#222] sm:text-[38px]">Pas d&apos;articles pour le moment</h2>
            <p className="mx-auto mt-3 max-w-[760px] text-[15px] leading-7 text-[#666]">
              Notre catalogue est en cours de mise a jour. Revenez bientot pour decouvrir les nouveaux articles disponibles.
            </p>
          </section>
        )}

        <section className="mt-10 bg-transparent px-0 py-0 shadow-none ring-0 sm:rounded-[28px] sm:bg-white sm:px-6 sm:py-7 sm:shadow-[0_12px_36px_rgba(24,39,75,0.06)] sm:ring-1 sm:ring-black/5 lg:px-8">
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#767676]">
                {messages.history.recent}
              </div>
              <h2 className="mt-2 text-[24px] font-bold tracking-[-0.05em] text-[#222] sm:text-[36px]">
                {messages.hero.inspiredByVisits}
              </h2>
              <p className="mt-2 text-[15px] text-[#666]">
                {messages.history.subtitle}
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-[13px] text-[#666]">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#f8f8f8] px-4 py-2 ring-1 ring-black/5">
                <ShieldCheck className="h-4 w-4 text-[#ff6a00]" />
                {messages.common.verifiedSuppliers}
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-[#f8f8f8] px-4 py-2 ring-1 ring-black/5">
                <Clock3 className="h-4 w-4 text-[#ff6a00]" />
                {messages.history.shippingLabel} {pricing.shippingWindow}
              </div>
            </div>
          </div>

          {historyItems.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-5">
            {historyItems.map((item) => (
              <ProductCardItem
                key={item.slug}
                item={item}
                formatPrice={pricing.formatPrice}
                guaranteedLabel={messages.common.guaranteed}
                moqLabel={messages.common.moq}
                href={`/products/${item.slug}`}
              />
            ))}
          </div>
          ) : (
            <div className="rounded-[22px] bg-[#fff7f2] px-5 py-7 text-center ring-1 ring-[#f2dacb]">
              <p className="text-[15px] leading-7 text-[#666]">Aucun produit publie pour le moment. Cette section se remplira automatiquement apres tes imports.</p>
            </div>
          )}

          <div className="mt-8 flex justify-center">
            <Link href="/decouvrir-afripay" className="inline-flex items-center gap-2 rounded-full bg-[#ff6a00] px-6 py-3 text-[15px] font-semibold text-white shadow-[0_10px_20px_rgba(255,106,0,0.25)] transition hover:bg-[#e35f00]">
              {messages.common.learnMore}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#767676]">
                {messages.recommendations.heading}
              </div>
              <h2 className="mt-2 text-[24px] font-bold tracking-[-0.05em] text-[#222] sm:text-[30px]">{messages.recommendations.title}</h2>
            </div>
            <div className="rounded-full bg-white px-4 py-2 text-[13px] font-medium text-[#444] ring-1 ring-black/5">
              {messages.recommendations.algorithm}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-[1.1fr_repeat(4,1fr)]">
            <article className="relative col-span-2 overflow-hidden rounded-[24px] bg-[linear-gradient(145deg,#1f120d_0%,#4a1d0f_45%,#d64000_100%)] px-5 py-5 text-white shadow-[0_18px_48px_rgba(49,20,10,0.18)] sm:rounded-[28px] sm:px-7 sm:py-7 lg:col-span-1">
              <div className="absolute -right-16 top-0 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
              <div className="absolute bottom-0 left-0 h-32 w-full bg-[linear-gradient(180deg,transparent_0%,rgba(0,0,0,0.18)_100%)]" />
              <div className="relative z-10 max-w-[320px]">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1 text-[12px] font-semibold uppercase tracking-[0.16em] text-white/90">
                  <Sparkles className="h-4 w-4" />
                  {messages.recommendations.premium}
                </div>
                <h3 className="mt-4 text-[24px] font-bold leading-[1.05] tracking-[-0.05em] sm:mt-5 sm:text-[31px]">
                  {messages.recommendations.readyFor} {pricing.countryLabel}
                </h3>
                <p className="mt-3 text-[13px] leading-5 text-white/80 sm:mt-4 sm:text-[15px] sm:leading-6">
                  {messages.recommendations.description}
                </p>
                <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  <div className="rounded-[18px] bg-white/10 px-4 py-4 backdrop-blur-sm">
                    <div className="text-[12px] uppercase tracking-[0.14em] text-white/70">{messages.common.shipping}</div>
                    <div className="mt-2 text-[20px] font-semibold">{pricing.shippingWindow}</div>
                  </div>
                  <div className="rounded-[18px] bg-white/10 px-4 py-4 backdrop-blur-sm">
                    <div className="text-[12px] uppercase tracking-[0.14em] text-white/70">{messages.common.currency}</div>
                    <div className="mt-2 text-[20px] font-semibold">{pricing.currency.code}</div>
                  </div>
                </div>
              </div>
            </article>

            {recommendationProducts.map((product, index) => {
              const copy = recommendationCopy[index] ?? recommendationCopy[recommendationCopy.length - 1];

              return (
              <Link
                key={product.slug}
                href={`/products/${product.slug}`}
                className="overflow-hidden rounded-[18px] bg-white shadow-[0_12px_36px_rgba(24,39,75,0.06)] ring-1 ring-black/5 sm:rounded-[24px]"
              >
                <div className="relative aspect-[1/1.02] overflow-hidden bg-[#f3f3f3]">
                  <Image
                    src={product.image}
                    alt={product.title}
                    fill
                    sizes="(min-width: 1280px) 17vw, (min-width: 1024px) 22vw, (min-width: 640px) 35vw, 92vw"
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_15%,rgba(0,0,0,0.45)_100%)]" />
                  <div className="absolute left-3 top-3 rounded-full bg-white/92 px-2.5 py-1 text-[10px] font-semibold text-[#222] sm:left-4 sm:top-4 sm:px-3 sm:text-[11px]">
                    {copy.eyebrow}
                  </div>
                </div>
                <div className="p-3 sm:p-5">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#767676] sm:text-[11px] sm:tracking-[0.14em]">{copy.eta}</div>
                  <div className="mt-2 line-clamp-3 min-h-[56px] text-[14px] font-semibold leading-5 tracking-[-0.03em] text-[#222] sm:mt-3 sm:min-h-[72px] sm:text-[20px] sm:leading-6">
                    {product.title}
                  </div>
                  <div className="mt-3 whitespace-nowrap text-[13px] font-bold tracking-[-0.04em] text-[#d64000] sm:mt-4 sm:text-[15px] xl:text-[16px]">
                    {formatTierAwarePrice(pricing.formatPrice, product)}
                  </div>
                  <div className="mt-3 inline-flex items-center gap-2 text-[12px] font-semibold text-[#222] sm:mt-5 sm:text-[14px]">
                    {messages.common.viewOffer}
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </div>
              </Link>
            );})}
          </div>
        </section>

        <section className="mt-10 grid gap-5 lg:grid-cols-[1.35fr_1fr]">
          <article className="rounded-[28px] bg-white px-6 py-6 shadow-[0_12px_36px_rgba(24,39,75,0.06)] ring-1 ring-black/5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#767676]">
                  {messages.pricing.heading}
                </div>
                <h3 className="mt-2 text-[28px] font-bold tracking-[-0.05em] text-[#222]">
                  {messages.pricing.title}
                </h3>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-[#fff4eb] px-4 py-2 text-[14px] font-semibold text-[#d64000]">
                {pricing.flagEmoji} {pricing.countryCode}
              </div>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-[20px] bg-[#f8f8f8] px-4 py-4">
                <div className="text-[12px] uppercase tracking-[0.14em] text-[#767676]">{messages.common.language}</div>
                <div className="mt-2 text-[18px] font-semibold text-[#222]">{pricing.languageLabel}</div>
              </div>
              <div className="rounded-[20px] bg-[#f8f8f8] px-4 py-4">
                <div className="text-[12px] uppercase tracking-[0.14em] text-[#767676]">{messages.pricing.logisticsWindow}</div>
                <div className="mt-2 text-[18px] font-semibold text-[#222]">{pricing.shippingWindow}</div>
              </div>
              <div className="rounded-[20px] bg-[#f8f8f8] px-4 py-4">
                <div className="text-[12px] uppercase tracking-[0.14em] text-[#767676]">{messages.pricing.conversion}</div>
                <div className="mt-2 text-[15px] font-semibold text-[#222]">{pricing.exchangeLabel}</div>
              </div>
            </div>
          </article>

          <article className="rounded-[28px] bg-white px-6 py-6 shadow-[0_12px_36px_rgba(24,39,75,0.06)] ring-1 ring-black/5">
            <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#767676]">
              {messages.assistance.heading}
            </div>
            <h3 className="mt-2 text-[28px] font-bold tracking-[-0.05em] text-[#222]">
              {messages.assistance.title}
            </h3>
            <div className="mt-4 space-y-3 text-[15px] text-[#555]">
              <div className="flex items-center justify-between rounded-[18px] bg-[#f8f8f8] px-4 py-3">
                <span>{messages.nav.support}</span>
                <ArrowRight className="h-4 w-4 text-[#222]" />
              </div>
              <div className="flex items-center justify-between rounded-[18px] bg-[#f8f8f8] px-4 py-3">
                <UnavailableLink
                  label={messages.nav.appExtension}
                  message={messages.unavailable.message}
                  className="text-left text-[15px] text-[#555]"
                  tooltipClassName="right-0 top-[calc(100%+10px)]"
                />
                <ArrowRight className="h-4 w-4 text-[#222]" />
              </div>
            </div>
          </article>
        </section>
      </div>

      <footer className="border-t border-[#ddd] bg-white">
        <div className="mx-auto grid max-w-[1440px] gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.2fr_repeat(3,1fr)] xl:px-10">
          <div>
            <div className="text-[28px] font-bold tracking-[-0.05em] text-[#ff6a00]">AfriPay</div>
            <p className="mt-4 max-w-[360px] text-[14px] leading-6 text-[#666]">
              {messages.footer.description}
            </p>
          </div>
          <div>
            <div className="text-[14px] font-semibold text-[#222]">{messages.footer.buyers}</div>
            <div className="mt-4 space-y-3 text-[14px] text-[#666]">
              <div>{messages.footer.history}</div>
              <div>{messages.footer.recommendedProducts}</div>
              <div>{messages.nav.orderProtection}</div>
            </div>
          </div>
          <div>
            <div className="text-[14px] font-semibold text-[#222]">{messages.footer.services}</div>
            <div className="mt-4 space-y-3 text-[14px] text-[#666]">
              <div>{messages.footer.supportCenter}</div>
              <div>{messages.footer.application}</div>
              <div>{messages.footer.sellerSupport}</div>
            </div>
          </div>
          <div>
            <div className="text-[14px] font-semibold text-[#222]">{messages.footer.currentContext}</div>
            <div className="mt-4 space-y-3 text-[14px] text-[#666]">
              <div>{pricing.flagEmoji} {pricing.countryLabel}</div>
              <div>{pricing.currency.code}</div>
              <div>{pricing.shippingWindow}</div>
            </div>
          </div>
        </div>
      </footer>
      <MobileBottomNav />
    </main>
  );
}
