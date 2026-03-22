import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Gift, PackageCheck, RefreshCcw, ShieldCheck, TicketPercent } from "lucide-react";

import { InternalPageShell } from "@/components/internal-page-shell";
import { LiveCountdownBadge } from "@/components/live-countdown-badge";
import { ModePromoHero } from "@/components/mode-promo-hero";
import { getProductsBySlugs } from "@/lib/products-data";
import { getPricingContext } from "@/lib/pricing";

const groupedOfferSlugs = [
  "bean-bag-gaming-oxford",
  "combo-clavier-souris-onikuma-rgb",
  "tapis-souris-clavier-rgb-chauffant",
];

const dailyDealSlugs = [
  "fauteuil-gaming-rgb-oem-luxe",
  "bureau-gaming-fibre-carbone-led",
  "lunettes-vr-3d-metavers-hifi",
];

const premiumSelectionSlugs = [
  "souris-gaming-g502x-rgb-usb",
  "machine-vr-9d-moviepower",
  "hoodie-oversize-coton-unisexe",
  "ensemble-sport-femme-deux-pieces",
  "bureau-esport-design-simple",
  "piercing-g23-titane-zircon",
];

const choiceDealsSlugs = [
  "souris-gaming-g502x-rgb-usb",
  "combo-clavier-souris-onikuma-rgb",
  "bureau-esport-design-simple",
  "hoodie-oversize-coton-unisexe",
];

const trendPromoSlugs = [
  "ensemble-sport-femme-deux-pieces",
  "piercing-g23-titane-zircon",
  "bean-bag-gaming-oxford",
  "machine-vr-9d-moviepower",
];

const flashRushSlugs = [
  "hoodie-oversize-coton-unisexe",
  "ensemble-sport-femme-deux-pieces",
  "souris-gaming-g502x-rgb-usb",
  "lunettes-vr-3d-metavers-hifi",
  "combo-clavier-souris-onikuma-rgb",
  "piercing-g23-titane-zircon",
];

const finalDropSlugs = [
  "bureau-gaming-fibre-carbone-led",
  "bean-bag-gaming-oxford",
  "tapis-souris-clavier-rgb-chauffant",
  "machine-vr-9d-moviepower",
  "fauteuil-gaming-rgb-oem-luxe",
  "hoodie-oversize-coton-unisexe",
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

export default async function ModePage() {
  const pricing = await getPricingContext();
  const groupedOffers = getProductsBySlugs(groupedOfferSlugs);
  const dailyDeals = getProductsBySlugs(dailyDealSlugs);
  const premiumSelection = getProductsBySlugs(premiumSelectionSlugs);
  const choiceDeals = getProductsBySlugs(choiceDealsSlugs);
  const trendPromos = getProductsBySlugs(trendPromoSlugs);
  const flashRushProducts = getProductsBySlugs(flashRushSlugs);
  const finalDropProducts = getProductsBySlugs(finalDropSlugs);
  const heroSpotlight = dailyDeals[0] ?? groupedOffers[0];
  const heroSlides = [
    {
      id: "anniversary-promo",
      deadlinePrefix: "Fin de la promo :",
      endsAt: "2026-03-25T22:59:00Z",
      headline: "Jusqu'à -60%",
      spotlightTitle: "Les meilleures offres...",
      spotlightPrice: heroSpotlight ? pricing.formatPrice(heroSpotlight.minUsd) : "23,99€",
      spotlightHref: heroSpotlight ? `/products/${heroSpotlight.slug}` : "/products",
      spotlightImage: heroSpotlight?.image ?? "/products/fashion-hoodie.svg",
      accentColor: "#ffffff",
      coupons: [
        { value: "-125€", limit: "dès 899€ d'achat", code: "SMB125" },
        { value: "-110€", limit: "dès 799€ d'achat", code: "SMB110" },
        { value: "-85€", limit: "dès 529€ d'achat", code: "FRAS85" },
      ],
    },
    {
      id: "choice-fashion",
      deadlinePrefix: "Choice Mode se termine dans :",
      endsAt: "2026-03-24T21:30:00Z",
      headline: "Mode Premium",
      spotlightTitle: "Streetwear & activewear...",
      spotlightPrice: pricing.formatPrice(9.85),
      spotlightHref: "/products?q=mode",
      spotlightImage: "/products/fashion-activewear.svg",
      accentColor: "#ff7bd3",
      coupons: [
        { value: "-30%", limit: "dès 99€ d'achat", code: "STYLE30" },
        { value: "-22%", limit: "dès 69€ d'achat", code: "LOOK22" },
        { value: "-15%", limit: "dès 39€ d'achat", code: "PINK15" },
      ],
    },
  ];

  return (
    <InternalPageShell pricing={pricing}>
      <div className="space-y-8">
        <ModePromoHero slides={heroSlides} />

        <section className="grid gap-px overflow-hidden rounded-[24px] border border-[#efe5df] bg-[#efe5df] md:grid-cols-3">
          {[
            { icon: PackageCheck, title: "Livraison gratuite", description: "Sur tous les articles Choice" },
            { icon: ShieldCheck, title: "Livraison rapide", description: "Remboursement en cas de problème de livraison" },
            { icon: RefreshCcw, title: "Retour gratuit", description: "Pour des millions d'articles" },
          ].map((feature) => {
            const Icon = feature.icon;

            return (
              <div key={feature.title} className="flex items-center gap-3 bg-white px-5 py-4 text-[#5b2b14] sm:px-6">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#fff1e6] text-[#9f4d18]">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="text-[16px]">
                  <span className="font-bold">{feature.title}</span>
                  <span className="text-[#7c5b49]"> {feature.description}</span>
                </div>
              </div>
            );
          })}
        </section>

        <section className="space-y-6">
          <h2 className="text-center text-[40px] font-black tracking-[-0.06em] text-[#222]">Offres du jour</h2>

          <div className="grid gap-6 xl:grid-cols-2">
            <article className="rounded-[30px] border border-[#ece6e1] bg-white px-6 py-7 shadow-[0_16px_36px_rgba(17,24,39,0.05)] sm:px-8">
              <div className="text-center">
                <h3 className="text-[28px] font-black tracking-[-0.05em] text-[#222]">Offres groupées</h3>
                <div className="mt-5 inline-flex items-center gap-3 rounded-full bg-[#fff1cc] px-6 py-3 text-[17px] font-bold text-[#111] shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
                  <TicketPercent className="h-6 w-6 text-[#ff8b00]" />
                  3+ dès 2,39€
                  <ChevronRight className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-8 grid gap-6 sm:grid-cols-3">
                {groupedOffers.map((product) => (
                  <Link key={product.slug} href={`/products/${product.slug}`} className="group block">
                    <div className="relative aspect-[0.86] overflow-hidden rounded-[18px] bg-[#f6f6f6]">
                      <Image src={product.image} alt={product.title} fill sizes="(min-width: 1280px) 18vw, 28vw" className="object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                    </div>
                    <div className="mt-4 line-clamp-2 text-[18px] leading-8 tracking-[-0.03em] text-[#111]">{product.title}</div>
                    <div className="mt-3 flex items-end gap-2">
                      <span className="text-[19px] font-black text-[#ff143c]">{pricing.formatPrice(product.minUsd)}</span>
                      <span className="text-[16px] text-[#8c8c8c] line-through">{pricing.formatPrice((product.maxUsd ?? product.minUsd) * 1.14)}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-[16px] text-[#222]">
                      <span className="text-[#ffad14]">★</span>
                      <span className="font-semibold">4.8</span>
                      <span className="text-[#555]">479 vendu(s)</span>
                    </div>
                  </Link>
                ))}
              </div>
            </article>

            <article className="rounded-[30px] border border-[#ece6e1] bg-white px-6 py-7 shadow-[0_16px_36px_rgba(17,24,39,0.05)] sm:px-8">
              <div className="text-center">
                <h3 className="text-[28px] font-black tracking-[-0.05em] text-[#222]">Deal du Jour</h3>
                <div className="mt-5 flex items-center justify-center gap-3">
                  <LiveCountdownBadge
                    endsAt="2026-03-23T16:38:05Z"
                    prefix="Finit dans :"
                    className="inline-flex items-center gap-3 rounded-full bg-[#ffe7ea] px-6 py-3 text-[17px] font-bold text-[#111] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]"
                    iconClassName="h-6 w-6 text-[#ff4d5d]"
                  />
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#ffe7ea] text-[#111] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                    <ChevronRight className="h-5 w-5" />
                  </div>
                </div>
              </div>

              <div className="mt-8 grid gap-6 sm:grid-cols-3">
                {dailyDeals.map((product, index) => (
                  <Link key={product.slug} href={`/products/${product.slug}`} className="group block">
                    <div className="relative aspect-[0.86] overflow-hidden rounded-[18px] bg-[#f6f6f6]">
                      <Image src={product.image} alt={product.title} fill sizes="(min-width: 1280px) 18vw, 28vw" className="object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                    </div>
                    <div className="mt-4 line-clamp-2 text-[18px] leading-8 tracking-[-0.03em] text-[#111]">{product.title}</div>
                    <div className="mt-3 flex items-end gap-2">
                      <span className="text-[19px] font-black text-[#111]">{pricing.formatPrice(product.minUsd)}</span>
                      <span className="text-[16px] text-[#8c8c8c] line-through">{pricing.formatPrice((product.maxUsd ?? product.minUsd) * 1.04)}</span>
                    </div>
                    <div className="mt-3 inline-flex items-center justify-center bg-[#ff143c] px-2 py-1 text-[14px] font-bold text-white">-{index === 0 ? "1" : index === 1 ? "6" : "2"}%</div>
                  </Link>
                ))}
              </div>
            </article>
          </div>
        </section>

        <section className="rounded-[30px] bg-[linear-gradient(180deg,#fff_0%,#fff8fb_100%)] px-6 py-7 shadow-[0_16px_36px_rgba(17,24,39,0.05)] ring-1 ring-black/5 sm:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-[#fff1e7] px-4 py-2 text-[13px] font-bold uppercase tracking-[0.16em] text-[#d85300]">
                <Gift className="h-4 w-4" />
                Sélection premium
              </div>
              <h2 className="mt-4 text-[34px] font-black tracking-[-0.05em] text-[#222]">Les best-sellers à pousser aujourd&apos;hui</h2>
              <p className="mt-2 max-w-[760px] text-[16px] leading-8 text-[#555]">Une grille dense et premium, pensée comme une vraie page mode marketplace avec prix, badges et lecture rapide.</p>
            </div>
            <Link href="/products" className="inline-flex h-14 min-w-[320px] items-center justify-center gap-3 rounded-full border border-black/10 bg-[#222] px-8 shadow-[0_16px_30px_rgba(17,24,39,0.18)] transition hover:-translate-y-0.5 hover:bg-black hover:shadow-[0_20px_36px_rgba(17,24,39,0.24)]">
              <span className="text-[16px] font-extrabold tracking-[-0.02em] text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.35)]">
                Voir le catalogue
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-white" />
            </Link>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {premiumSelection.map((product) => (
              <Link key={product.slug} href={`/products/${product.slug}`} className="group overflow-hidden rounded-[20px] bg-white ring-1 ring-black/5 transition hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(17,24,39,0.12)]">
                <div className="relative aspect-[0.96] bg-[#f4f4f4]">
                  {product.badge ? <div className="absolute left-2 top-2 z-10 rounded-full bg-[#ff143c] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-white">{product.badge}</div> : null}
                  <Image src={product.image} alt={product.title} fill sizes="(min-width: 1280px) 15vw, 30vw" className="object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                </div>
                <div className="p-3">
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#ff5d00]">Mode premium</div>
                  <div className="mt-2 line-clamp-2 min-h-[40px] text-[13px] font-semibold leading-5 text-[#222]">{product.title}</div>
                  <div className="mt-2 text-[16px] font-black tracking-[-0.03em] text-[#111]">{formatPriceRange(pricing.formatPrice, product.minUsd, product.maxUsd)}</div>
                  <div className="mt-1 text-[12px] text-[#666]">MOQ: {product.moq} {product.unit}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <article className="rounded-[30px] border border-[#ece6e1] bg-white px-6 py-7 shadow-[0_16px_36px_rgba(17,24,39,0.05)] sm:px-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-[13px] font-bold uppercase tracking-[0.16em] text-[#ff5d00]">Choice à petits prix</div>
                <h2 className="mt-3 text-[32px] font-black tracking-[-0.05em] text-[#222]">Des mini deals comme sur une vraie home promo</h2>
              </div>
              <div className="rounded-full bg-[#fff1cc] px-5 py-2 text-[15px] font-bold text-[#222]">Expédition prioritaire</div>
            </div>

                <div className="mt-8 grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-4">
              {choiceDeals.map((product, index) => (
                  <Link key={product.slug} href={`/products/${product.slug}`} className="group overflow-hidden rounded-[16px] border border-[#ece6e1] bg-[#fffdfc] p-2.5 transition hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(17,24,39,0.1)] sm:rounded-[22px] sm:p-3">
                  <div className="relative aspect-square overflow-hidden rounded-[18px] bg-[#f6f6f6]">
                    <Image src={product.image} alt={product.title} fill sizes="(min-width: 1280px) 18vw, 40vw" className="object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                    <div className="absolute left-2 top-2 rounded-full bg-[#ff143c] px-2 py-1 text-[10px] font-bold text-white">-{12 + index * 3}%</div>
                  </div>
                  <div className="mt-2 line-clamp-2 text-[12px] font-semibold leading-4 text-[#222] sm:mt-3 sm:text-[15px] sm:leading-6">{product.title}</div>
                  <div className="mt-2 text-[14px] font-black text-[#ff143c] sm:text-[18px]">{pricing.formatPrice(product.minUsd)}</div>
                  <div className="mt-1 text-[10px] text-[#666] sm:text-[13px]">Choice • Livraison offerte</div>
                </Link>
              ))}
            </div>
          </article>

          <article className="rounded-[30px] bg-[linear-gradient(180deg,#ff0a68_0%,#ff4d8d_100%)] px-6 py-7 text-white shadow-[0_20px_44px_rgba(255,10,104,0.22)] sm:px-8">
            <div className="text-[13px] font-bold uppercase tracking-[0.16em] text-white/80">Boost shopping</div>
            <h2 className="mt-3 text-[36px] font-black tracking-[-0.06em]">Coupons, badges et sélections flash</h2>
            <p className="mt-3 text-[16px] leading-8 text-white/88">Le bas de page reprend la logique marketplace: blocs serrés, gros prix, promos courtes et cartes très lisibles.</p>

            <div className="mt-8 space-y-4">
              {[
                { label: "Coupon mode", value: "-18€", detail: "dès 120€" },
                { label: "Deal express", value: "-12€", detail: "dès 79€" },
                { label: "Bundle look", value: "-8€", detail: "dès 49€" },
              ].map((entry) => (
                <div key={entry.label} className="flex items-center justify-between rounded-[22px] bg-white/12 px-5 py-4 ring-1 ring-white/20 backdrop-blur-sm">
                  <div>
                    <div className="text-[14px] font-semibold uppercase tracking-[0.12em] text-white/72">{entry.label}</div>
                    <div className="mt-1 text-[15px] text-white/88">{entry.detail}</div>
                  </div>
                  <div className="text-[30px] font-black tracking-[-0.04em]">{entry.value}</div>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="rounded-[30px] border border-[#ece6e1] bg-white px-6 py-7 shadow-[0_16px_36px_rgba(17,24,39,0.05)] sm:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-[13px] font-bold uppercase tracking-[0.16em] text-[#ff5d00]">Inspiration du moment</div>
              <h2 className="mt-3 text-[34px] font-black tracking-[-0.05em] text-[#222]">Encore plus de blocs promo style marketplace</h2>
            </div>
            <Link href="/products?q=promo" className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-[#e5d8cf] px-6 text-[15px] font-bold text-[#222] transition hover:border-[#ff6a00] hover:text-[#ff6a00]">
              Voir les promos
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

            <div className="mt-8 grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
            {trendPromos.map((product, index) => (
              <Link key={product.slug} href={`/products/${product.slug}`} className={["group rounded-[18px] p-3 text-white shadow-[0_16px_34px_rgba(17,24,39,0.08)] transition hover:-translate-y-1 sm:rounded-[24px] sm:p-4", index % 2 === 0 ? "bg-[linear-gradient(180deg,#ff3f7f_0%,#ff1762_100%)]" : "bg-[linear-gradient(180deg,#ffae2b_0%,#ff7d14_100%)]"].join(" ")}>
                <div className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/76">Flash pick</div>
                <div className="mt-4 flex items-start justify-between gap-4">
                  <div className="max-w-[150px]">
                    <div className="line-clamp-3 text-[16px] font-black leading-5 tracking-[-0.04em] sm:text-[22px] sm:leading-7">{product.shortTitle}</div>
                    <div className="mt-3 text-[12px] text-white/88 sm:mt-4 sm:text-[15px]">À partir de {pricing.formatPrice(product.minUsd)}</div>
                  </div>
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[14px] bg-white/20 sm:h-24 sm:w-24 sm:rounded-[18px]">
                    <Image src={product.image} alt={product.title} fill sizes="96px" className="object-cover" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.78fr_1.22fr]">
          <article className="overflow-hidden rounded-[30px] bg-[linear-gradient(180deg,#ff0a68_0%,#ff4f93_100%)] px-6 py-7 text-white shadow-[0_24px_44px_rgba(255,10,104,0.22)] sm:px-8">
            <div className="text-[13px] font-bold uppercase tracking-[0.16em] text-white/78">Rush coupons</div>
            <h2 className="mt-3 text-[36px] font-black tracking-[-0.06em]">Promo AfriPay</h2>
            <p className="mt-3 max-w-[420px] text-[16px] leading-8 text-white/88">Coupons en cascade, cartes éclairs et petits prix partout, comme une vraie page d&apos;offres dense.</p>

            <div className="mt-8 space-y-4">
              {[
                { amount: "-25€", min: "dès 159€", label: "Max coupon" },
                { amount: "-14€", min: "dès 89€", label: "Choix rapide" },
                { amount: "-9€", min: "dès 49€", label: "Dernière chance" },
              ].map((coupon) => (
                <div key={coupon.label} className="flex items-center justify-between rounded-[22px] bg-white/12 px-5 py-4 ring-1 ring-white/20 backdrop-blur-sm">
                  <div>
                    <div className="text-[13px] font-bold uppercase tracking-[0.12em] text-white/72">{coupon.label}</div>
                    <div className="mt-1 text-[15px] text-white/88">{coupon.min}</div>
                  </div>
                  <div className="text-[30px] font-black tracking-[-0.04em]">{coupon.amount}</div>
                </div>
              ))}
            </div>

            <Link href="/products?q=choice" className="mt-8 inline-flex h-14 min-w-[280px] items-center justify-center gap-3 self-start rounded-full bg-[#ff9f1a] px-8 text-[15px] font-extrabold text-white shadow-[0_16px_30px_rgba(255,159,26,0.34)] transition hover:-translate-y-0.5 hover:bg-[#ff8c00] hover:shadow-[0_20px_36px_rgba(255,140,0,0.38)]">
              Explorer les deals flash
              <ChevronRight className="h-4 w-4 text-white" />
            </Link>
          </article>

          <article className="rounded-[30px] border border-[#ece6e1] bg-white px-6 py-7 shadow-[0_16px_36px_rgba(17,24,39,0.05)] sm:px-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-[13px] font-bold uppercase tracking-[0.16em] text-[#ff5d00]">Vente éclair 24h</div>
                <h2 className="mt-3 text-[32px] font-black tracking-[-0.05em] text-[#222]">Mosaïque promo</h2>
              </div>
              <div className="rounded-full bg-[#fff1cc] px-5 py-2 text-[15px] font-bold text-[#222]">Best deals mis à jour</div>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-3">
              {flashRushProducts.map((product, index) => (
                <Link key={product.slug} href={`/products/${product.slug}`} className="group overflow-hidden rounded-[16px] border border-[#eee5dd] bg-[#fffdfb] p-2.5 transition hover:-translate-y-1 hover:shadow-[0_18px_38px_rgba(17,24,39,0.1)] sm:rounded-[22px] sm:p-3">
                  <div className="relative aspect-[1.05] overflow-hidden rounded-[18px] bg-[#f5f5f5]">
                    <div className="absolute left-2 top-2 z-10 rounded-full bg-[#ff143c] px-2 py-1 text-[10px] font-bold text-white">-{8 + index * 2}%</div>
                    <Image src={product.image} alt={product.title} fill sizes="(min-width: 1280px) 18vw, 40vw" className="object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                  </div>
                  <div className="mt-2 line-clamp-2 text-[12px] font-semibold leading-4 text-[#222] sm:mt-3 sm:text-[15px] sm:leading-6">{product.title}</div>
                  <div className="mt-2 flex items-end gap-2">
                    <span className="text-[14px] font-black text-[#ff143c] sm:text-[18px]">{pricing.formatPrice(product.minUsd)}</span>
                    <span className="text-[10px] text-[#8c8c8c] line-through sm:text-[13px]">{pricing.formatPrice((product.maxUsd ?? product.minUsd) * 1.1)}</span>
                  </div>
                  <div className="mt-1 text-[10px] text-[#666] sm:text-[13px]">Flash • Stock limité</div>
                </Link>
              ))}
            </div>
          </article>
        </section>

        <section className="rounded-[30px] border border-[#ece6e1] bg-[linear-gradient(180deg,#fff_0%,#fff7f2_100%)] px-6 py-7 shadow-[0_16px_36px_rgba(17,24,39,0.05)] sm:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-[13px] font-bold uppercase tracking-[0.16em] text-[#ff5d00]">Dernier drop promo</div>
              <h2 className="mt-3 text-[34px] font-black tracking-[-0.05em] text-[#222]">Une dernière rangée de mini cartes promo très marketplace</h2>
            </div>
            <Link href="/products?q=deal" className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-[#e5d8cf] px-6 text-[15px] font-bold text-[#222] transition hover:border-[#ff6a00] hover:text-[#ff6a00]">
              Voir tous les deals
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {finalDropProducts.map((product, index) => (
              <Link key={product.slug} href={`/products/${product.slug}`} className="group overflow-hidden rounded-[20px] bg-white ring-1 ring-black/5 transition hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(17,24,39,0.1)]">
                <div className="relative aspect-[0.94] bg-[#f4f4f4]">
                  <div className="absolute left-2 top-2 z-10 rounded-full bg-[#111] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-white">Hot {index + 1}</div>
                  <Image src={product.image} alt={product.title} fill sizes="(min-width: 1280px) 15vw, 30vw" className="object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                </div>
                <div className="p-3">
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#ff5d00]">Deal final</div>
                  <div className="mt-2 line-clamp-2 min-h-[40px] text-[13px] font-semibold leading-5 text-[#222]">{product.title}</div>
                  <div className="mt-2 text-[16px] font-black text-[#111]">{formatPriceRange(pricing.formatPrice, product.minUsd, product.maxUsd)}</div>
                  <div className="mt-1 text-[12px] text-[#666]">Promo courte • MOQ {product.moq}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>

      </div>
    </InternalPageShell>
  );
}