import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Camera, Clock3, ScrollText, ShieldCheck, Sparkles, WandSparkles, type LucideIcon } from "lucide-react";

import { CategoryMegaMenu } from "@/components/category-mega-menu";
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
import { getMessages } from "@/lib/messages";
import {
  discoveryExploreGroups,
  discoveryHistorySlugs,
  getProductBySlug,
  getProductsBySlugs,
  historyProductSlugs,
  recommendationProductSlugs,
  type ProductCatalogItem,
} from "@/lib/products-data";
import { getPricingContext } from "@/lib/pricing";

type RecommendationCard = {
  slug: string;
  title: string;
  eyebrow: string;
  eta: string;
};

type QuickAction = {
  title: string;
  icon: LucideIcon;
  href: string;
};

const recommendationItems: RecommendationCard[] = [
  {
    slug: "fauteuil-gaming-rgb-oem-luxe",
    eyebrow: "Pour votre sourcing",
    title: "Fauteuils gaming RGB avec expédition accélérée vers votre pays",
    eta: "Départ sous 5 jours",
  },
  {
    slug: "combo-clavier-souris-onikuma-rgb",
    eyebrow: "Tendance usines",
    title: "Accessoires PC OEM et kits souris-clavier prêts à personnaliser",
    eta: "MOQ souple",
  },
  {
    slug: "bureau-gaming-fibre-carbone-led",
    eyebrow: "Volume B2B",
    title: "Mobilier gaming et bureaux fibre carbone avec faible MOQ",
    eta: "Devis usine en 24 h",
  },
  {
    slug: "lunettes-vr-3d-metavers-hifi",
    eyebrow: "Assemblage rapide",
    title: "Casques et lunettes VR pour revendeurs, salles d'arcade et bundles gaming",
    eta: "Échantillon disponible",
  },
];

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
          {formatPriceRange(formatPrice, item.minUsd, item.maxUsd)}
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
  const pricing = await getPricingContext();
  const messages = getMessages(pricing.languageCode);
  const historyItems = getProductsBySlugs(historyProductSlugs);
  const recommendationProducts = getProductsBySlugs(recommendationProductSlugs);
  const discoveryHistoryItems = getProductsBySlugs(discoveryHistorySlugs);
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
  const discoveryExploreCards = discoveryExploreGroups.map((group) => ({
    id: group.id,
    title: group.title,
    subtitle: group.subtitle,
    items: group.items.map((entry, index) => {
      const product = getProductBySlug(entry.slug);

      if (!product) {
        return {
          title: `${group.id}-${index}`,
          image: discoveryHistoryItems[0]?.image ?? "",
          price: pricing.formatPrice(entry.priceUsd),
        };
      }

      return {
        title: `${product.title}-${index}`,
        image: product.image,
        price: pricing.formatPrice(entry.priceUsd),
        href: `/products/${product.slug}`,
      };
    }),
  }));
  const discoverySlides = [
    {
      id: "coup-de-coeur-1",
      image: "https://s.alicdn.com/@sc04/kf/He21b090337c74bbaa1212b233936914aa.jpg_350x350.jpg",
      alt: "Selection premium AfriPay",
      eyebrow: "AfriPay Selection",
      title: "Choix premium du moment",
      subtitle: "Mobilier gaming, accessoires et visuels phares du catalogue.",
      buttonLabel: "En savoir plus",
      href: "/favorites",
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
      />
      <header className="relative z-30 bg-[linear-gradient(180deg,#efd9cf_0%,#f8e7dc_16%,#f4f4f4_100%)]">
        <div className="bg-[#ff6a00] text-white">
          <div className="mx-auto flex max-w-[1580px] items-center justify-between px-4 py-2 text-[11px] sm:px-6 sm:text-[13px] xl:px-10">
            <p className="line-clamp-2 max-w-[78%] leading-4 sm:truncate sm:leading-normal">
              <span className="sm:hidden">AfriPay Marketplace, plateforme de sourcing .</span>
              <span className="hidden sm:inline">{messages.topBar.description}</span>
            </p>
            <a href="#" className="hidden font-semibold sm:inline">
              {messages.topBar.supplierOffers}
            </a>
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
                <MobileCategoryStrip allLabel="Tous" />
              </div>

              <nav className="grid grid-cols-4 gap-2.5 xl:hidden">
                <Link href="/mode" className="flex min-w-0 items-center justify-center rounded-[14px] bg-white/65 px-1 py-3 text-center text-[12px] font-semibold text-[#222] backdrop-blur-sm">Mode</Link>
                <Link href="/products" className="flex min-w-0 items-center justify-center rounded-[14px] bg-white/65 px-1 py-3 text-center text-[12px] font-semibold text-[#222] backdrop-blur-sm">Produits</Link>
                <Link href="/trends" className="flex min-w-0 items-center justify-center rounded-[14px] bg-white/65 px-1 py-3 text-center text-[12px] font-semibold text-[#222] backdrop-blur-sm">Tendances</Link>
                <Link href="/pricing" className="flex min-w-0 items-center justify-center rounded-[14px] bg-white/65 px-1 py-3 text-center text-[12px] font-semibold text-[#222] backdrop-blur-sm">Tarifs</Link>
              </nav>

              <div className="hidden xl:flex xl:flex-row xl:items-center xl:justify-between">
              <nav className="flex flex-wrap items-center gap-x-7 gap-y-2 text-[#222]">
                <CategoryMegaMenu
                  languageCode={pricing.languageCode}
                  triggerClassName="inline-flex items-center gap-2 py-1 font-semibold"
                  panelClassName="top-[calc(100%+12px)]"
                  widthClassName="w-[1360px]"
                />
                <Link href="/" className="font-medium text-[#444]">
                  {messages.nav.localSections}
                </Link>
                <OrderProtectionMenu
                  languageCode={pricing.languageCode}
                  triggerClassName="inline-flex items-center py-1 font-medium text-[#444]"
                  panelClassName="top-[calc(100%+12px)]"
                  widthClassName="w-[1120px]"
                />
              </nav>
              <nav className="flex flex-wrap items-center gap-x-7 gap-y-2 text-[#444]">
                <AboutMenu triggerLabel={messages.nav.about} className="transition hover:text-[#ff6a00]" />
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

          <div className="mt-8 flex justify-center">
            <button className="inline-flex items-center gap-2 rounded-full bg-[#ff6a00] px-6 py-3 text-[15px] font-semibold text-white shadow-[0_10px_20px_rgba(255,106,0,0.25)] transition hover:bg-[#e35f00]">
              {messages.common.learnMore}
              <ArrowRight className="h-4 w-4" />
            </button>
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

            {recommendationItems.map((item) => {
              const product = recommendationProducts.find((entry) => entry.slug === item.slug);

              if (!product) {
                return null;
              }

              return (
              <Link
                key={item.slug}
                href={`/products/${product.slug}`}
                className="overflow-hidden rounded-[18px] bg-white shadow-[0_12px_36px_rgba(24,39,75,0.06)] ring-1 ring-black/5 sm:rounded-[24px]"
              >
                <div className="relative aspect-[1/1.02] overflow-hidden bg-[#f3f3f3]">
                  <Image
                    src={product.image}
                    alt={item.title}
                    fill
                    sizes="(min-width: 1280px) 17vw, (min-width: 1024px) 22vw, (min-width: 640px) 35vw, 92vw"
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_15%,rgba(0,0,0,0.45)_100%)]" />
                  <div className="absolute left-3 top-3 rounded-full bg-white/92 px-2.5 py-1 text-[10px] font-semibold text-[#222] sm:left-4 sm:top-4 sm:px-3 sm:text-[11px]">
                    {item.eyebrow}
                  </div>
                </div>
                <div className="p-3 sm:p-5">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#767676] sm:text-[11px] sm:tracking-[0.14em]">{item.eta}</div>
                  <div className="mt-2 line-clamp-3 min-h-[56px] text-[14px] font-semibold leading-5 tracking-[-0.03em] text-[#222] sm:mt-3 sm:min-h-[72px] sm:text-[20px] sm:leading-6">
                    {item.title}
                  </div>
                  <div className="mt-3 whitespace-nowrap text-[13px] font-bold tracking-[-0.04em] text-[#d64000] sm:mt-4 sm:text-[15px] xl:text-[16px]">
                    {formatPriceRange(pricing.formatPrice, product.minUsd, product.maxUsd)}
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
