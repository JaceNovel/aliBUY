import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Bolt, Clock3, Flame, Sparkles, TicketPercent } from "lucide-react";

import { InternalPageShell } from "@/components/internal-page-shell";
import { getCatalogProducts } from "@/lib/catalog-service";
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

export default async function DealsFlashPage() {
  const pricing = await getPricingContext();
  const products = await getCatalogProducts();
  const heroDeals = products.slice(0, 4);
  const rushDeals = products.slice(4, 8).length > 0 ? products.slice(4, 8) : products.slice(0, 4);
  const lastChanceDeals = products.slice(8, 12).length > 0 ? products.slice(8, 12) : products.slice(0, 4);
  const spotlight = heroDeals[0] ?? rushDeals[0] ?? lastChanceDeals[0];

  return (
    <InternalPageShell pricing={pricing}>
      <div className="space-y-5 pb-10 sm:space-y-8 sm:pb-0">
        <div className="flex flex-wrap items-center gap-2 text-[12px] text-[#7b675a] sm:text-[13px]">
          <Link href="/" className="transition hover:text-[#ff6a00]">Accueil</Link>
          <span>/</span>
          <Link href="/mode" className="transition hover:text-[#ff6a00]">Mode</Link>
          <span>/</span>
          <span className="font-semibold text-[#221f1c]">Deals flash</span>
        </div>

        <section className="overflow-hidden rounded-[28px] bg-[linear-gradient(135deg,#180f0d_0%,#6c281b_46%,#ff6a00_100%)] px-4 py-5 text-white shadow-[0_22px_50px_rgba(109,46,16,0.24)] sm:rounded-[34px] sm:px-8 sm:py-8 lg:px-10 lg:py-10">
          <div className="grid gap-5 lg:grid-cols-[1.08fr_0.92fr] lg:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-white/84 ring-1 ring-white/12 sm:px-4 sm:py-2 sm:text-[12px]">
                <Bolt className="h-4 w-4" />
                Centre deals flash
              </div>
              <h1 className="mt-3 max-w-[720px] text-[28px] font-black tracking-[-0.06em] sm:mt-4 sm:text-[44px] lg:text-[56px]">
                Tous les deals flash dans une page pensee pour le mobile.
              </h1>
              <p className="mt-3 max-w-[720px] text-[13px] leading-5 text-white/84 sm:text-[16px] sm:leading-8">
                Rail premium, cartes compactes, promotions lisibles et navigation rapide pour trouver les meilleures offres sans perdre de place sur petit ecran.
              </p>

              <div className="mt-4 flex flex-col gap-2.5 sm:mt-6 sm:flex-row sm:flex-wrap sm:gap-3">
                <Link href="#selection-flash" className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#ffd9c2] px-5 text-[13px] font-extrabold text-[#5a240d] shadow-[0_10px_24px_rgba(0,0,0,0.12)] transition hover:bg-[#ffc59f] sm:h-13 sm:px-7 sm:text-[15px]">
                  Voir les deals
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/products" className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 text-[13px] font-bold text-white transition hover:bg-white/16 sm:h-13 sm:px-7 sm:text-[15px]">
                  Retour au catalogue
                </Link>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-2.5 sm:mt-7 sm:gap-3">
                {[
                  { label: "Deals live", value: `${heroDeals.length + rushDeals.length}` },
                  { label: "Remise max", value: "-25%" },
                  { label: "Rail mobile", value: "Snap" },
                ].map((item) => (
                  <div key={item.label} className="rounded-[18px] bg-white/10 px-3 py-3 ring-1 ring-white/12 backdrop-blur-sm sm:rounded-[22px] sm:px-4 sm:py-4">
                    <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/68 sm:text-[11px]">{item.label}</div>
                    <div className="mt-1 text-[16px] font-black tracking-[-0.04em] text-white sm:text-[22px]">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>

            <Link href={spotlight ? `/products/${spotlight.slug}` : "/products"} className="group relative overflow-hidden rounded-[24px] bg-white/10 p-3 ring-1 ring-white/14 backdrop-blur-sm transition hover:-translate-y-1 hover:bg-white/14 sm:rounded-[30px] sm:p-4">
              <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-[#ffb36b] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#59250d] sm:right-4 sm:top-4">
                <Flame className="h-3.5 w-3.5" />
                Hot drop
              </div>
              <div className="relative aspect-[1.05] overflow-hidden rounded-[18px] bg-white/80 sm:rounded-[22px]">
                {spotlight ? (
                  <Image src={spotlight.image} alt={spotlight.title} fill sizes="(min-width: 1024px) 34vw, 92vw" className="object-cover transition-transform duration-300 group-hover:scale-[1.04]" />
                ) : null}
              </div>
              {spotlight ? (
                <div className="pt-3 sm:pt-4">
                  <div className="inline-flex rounded-full bg-white/16 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white/88">
                    Offre spotlight
                  </div>
                  <div className="mt-2 line-clamp-2 text-[18px] font-black leading-6 tracking-[-0.05em] text-white sm:text-[28px] sm:leading-8">
                    {spotlight.title}
                  </div>
                  <div className="mt-2 flex items-end gap-2">
                    <span className="text-[20px] font-black text-white sm:text-[28px]">{pricing.formatPrice(spotlight.minUsd)}</span>
                    <span className="text-[12px] text-white/66 line-through sm:text-[15px]">{pricing.formatPrice((spotlight.maxUsd ?? spotlight.minUsd) * 1.12)}</span>
                  </div>
                  <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#ff9f1a] px-3 py-1.5 text-[11px] font-bold text-white shadow-[0_12px_24px_rgba(255,159,26,0.28)] sm:text-[12px]">
                    <Clock3 className="h-4 w-4" />
                    Fin dans quelques heures
                  </div>
                </div>
              ) : null}
            </Link>
          </div>
        </section>

        {products.length > 0 ? (
        <>
        <section id="selection-flash" className="space-y-3 sm:space-y-6">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-[#fff1e7] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#d85300] sm:text-[12px]">
                <Sparkles className="h-4 w-4" />
                Selection flash
              </div>
              <h2 className="mt-1.5 text-[20px] font-black tracking-[-0.05em] text-[#222] sm:mt-2 sm:text-[34px]">Les deals a saisir maintenant</h2>
            </div>
            <Link href="/mode" className="hidden h-11 items-center justify-center rounded-full border border-[#e7d6ca] px-5 text-[14px] font-bold text-[#222] transition hover:border-[#ff6a00] hover:text-[#ff6a00] sm:inline-flex">
              Retour mode
            </Link>
          </div>

          <div className="-mx-4 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4">
            {heroDeals.map((product, index) => (
              <Link key={product.slug} href={`/products/${product.slug}`} className="group min-w-[146px] max-w-[146px] snap-start overflow-hidden rounded-[20px] bg-white p-2 shadow-[0_14px_26px_rgba(17,24,39,0.08)] ring-1 ring-black/5 transition hover:-translate-y-1 hover:shadow-[0_20px_36px_rgba(17,24,39,0.12)] sm:min-w-0 sm:max-w-none sm:rounded-[24px] sm:p-3">
                <div className="mb-1.5 flex items-center justify-between sm:mb-2">
                  <div className="inline-flex items-center rounded-full bg-[#fff0e7] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[#d85300]">
                    Flash live
                  </div>
                  <div className="rounded-full bg-[#111] px-2 py-1 text-[9px] font-bold text-white">-{10 + index * 3}%</div>
                </div>
                <div className="relative aspect-[0.9] overflow-hidden rounded-[15px] bg-[#f5f5f5] sm:aspect-[0.95] sm:rounded-[18px]">
                  <Image src={product.image} alt={product.title} fill sizes="(min-width: 1280px) 18vw, 44vw" className="object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                </div>
                <div className="mt-2 line-clamp-2 min-h-[32px] text-[11px] font-semibold leading-4 text-[#222] sm:mt-2.5 sm:min-h-[34px] sm:text-[14px] sm:leading-5">{product.title}</div>
                <div className="mt-1.5 flex items-end gap-1.5 sm:mt-2 sm:gap-2">
                  <span className="text-[12px] font-black text-[#ff4d21] sm:text-[18px]">{pricing.formatPrice(product.minUsd)}</span>
                  <span className="text-[9px] text-[#8b8b8b] line-through sm:text-[12px]">{pricing.formatPrice((product.maxUsd ?? product.minUsd) * 1.11)}</span>
                </div>
                <div className="mt-1.5 flex items-center gap-1.5 text-[9px] text-[#666] sm:mt-2 sm:gap-2 sm:text-[11px]">
                  <Clock3 className="h-3 w-3 text-[#ff6a00] sm:h-3.5 sm:w-3.5" />
                  Expire aujourd&apos;hui
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[0.92fr_1.08fr] sm:gap-6">
          <article className="rounded-[22px] bg-[linear-gradient(180deg,#ff0a68_0%,#ff4f93_100%)] px-3.5 py-4 text-white shadow-[0_18px_34px_rgba(255,10,104,0.20)] sm:rounded-[30px] sm:px-7 sm:py-7 sm:shadow-[0_22px_40px_rgba(255,10,104,0.22)]">
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/78 sm:text-[12px]">Coupons express</div>
            <h2 className="mt-2 text-[20px] font-black tracking-[-0.06em] sm:text-[34px]">Promos courtes et coupons cumulables</h2>
            <p className="mt-2 max-w-[92%] text-[12px] leading-5 text-white/86 sm:max-w-none sm:text-[15px] sm:leading-7">
              Une lecture simple sur mobile pour savoir quel coupon utiliser avant d&apos;ouvrir un produit ou de passer au devis.
            </p>
            <div className="mt-4 space-y-2.5 sm:mt-7 sm:space-y-3">
              {[
                { label: "Max coupon", value: "-25€", detail: "dès 159€" },
                { label: "Choix rapide", value: "-14€", detail: "dès 89€" },
                { label: "Dernière chance", value: "-9€", detail: "dès 49€" },
              ].map((coupon) => (
                <div key={coupon.label} className="flex items-center justify-between rounded-[16px] bg-white/12 px-3 py-2.5 ring-1 ring-white/16 backdrop-blur-sm sm:rounded-[22px] sm:px-5 sm:py-4">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/72 sm:text-[12px]">{coupon.label}</div>
                    <div className="mt-1 text-[12px] text-white/88 sm:text-[14px]">{coupon.detail}</div>
                  </div>
                  <div className="text-[18px] font-black tracking-[-0.04em] sm:text-[28px]">{coupon.value}</div>
                </div>
              ))}
            </div>
          </article>

          <article className="bg-transparent px-0 py-0 sm:rounded-[30px] sm:bg-white sm:px-7 sm:py-7 sm:shadow-[0_16px_36px_rgba(17,24,39,0.05)] sm:ring-1 sm:ring-black/5">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#d85300] sm:text-[12px]">
              <TicketPercent className="h-4 w-4" />
              Rush deals
            </div>
            <h2 className="mt-2 text-[24px] font-black tracking-[-0.05em] text-[#222] sm:text-[34px]">Bons plans qui tournent vite</h2>
            <div className="-mx-4 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0">
              {rushDeals.map((product, index) => (
                <Link key={product.slug} href={`/products/${product.slug}`} className="group min-w-[168px] snap-start overflow-hidden rounded-[22px] border border-[#eee4db] bg-[#fffdfb] p-2.5 transition hover:-translate-y-1 hover:shadow-[0_18px_34px_rgba(17,24,39,0.10)] sm:min-w-0 sm:rounded-[24px] sm:p-3">
                  <div className="relative aspect-[0.96] overflow-hidden rounded-[16px] bg-[#f6f6f6] sm:rounded-[18px]">
                    <div className="absolute left-2 top-2 z-10 rounded-full bg-[#ff143c] px-2 py-1 text-[9px] font-bold text-white">-{8 + index * 2}%</div>
                    <Image src={product.image} alt={product.title} fill sizes="(min-width: 1280px) 18vw, 44vw" className="object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                  </div>
                  <div className="mt-2 line-clamp-2 min-h-[34px] text-[12px] font-semibold leading-4 text-[#222] sm:text-[14px] sm:leading-5">{product.title}</div>
                  <div className="mt-2 text-[15px] font-black text-[#111] sm:text-[18px]">{pricing.formatPrice(product.minUsd)}</div>
                  <div className="mt-1 text-[10px] text-[#777] sm:text-[11px]">Stock express • Rail premium</div>
                </Link>
              ))}
            </div>
          </article>
        </section>

        <section className="bg-transparent px-0 py-0 sm:rounded-[30px] sm:bg-[linear-gradient(180deg,#fff_0%,#fff7f2_100%)] sm:px-7 sm:py-7 sm:shadow-[0_16px_36px_rgba(17,24,39,0.05)] sm:ring-1 sm:ring-black/5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#d85300] sm:text-[12px]">Dernière chance</div>
              <h2 className="mt-2 text-[24px] font-black tracking-[-0.05em] text-[#222] sm:text-[34px]">Fin de série à ne pas rater</h2>
            </div>
            <Link href="/quotes" className="hidden h-11 items-center justify-center rounded-full bg-[#222] px-5 text-[14px] font-bold text-white transition hover:bg-black sm:inline-flex">
              Demander un devis
            </Link>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:mt-7 sm:gap-4 lg:grid-cols-4">
            {lastChanceDeals.map((product, index) => (
              <Link key={product.slug} href={`/products/${product.slug}`} className="group overflow-hidden rounded-[20px] bg-white p-2.5 shadow-[0_16px_30px_rgba(17,24,39,0.08)] ring-1 ring-black/5 transition hover:-translate-y-1 hover:shadow-[0_22px_38px_rgba(17,24,39,0.12)] sm:rounded-[22px] sm:p-3">
                <div className="relative aspect-[0.94] overflow-hidden rounded-[16px] bg-[#f5f5f5] sm:rounded-[18px]">
                  <div className="absolute left-2 top-2 z-10 rounded-full bg-[#111] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-white">Hot {index + 1}</div>
                  <Image src={product.image} alt={product.title} fill sizes="(min-width: 1280px) 18vw, 44vw" className="object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                </div>
                <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#fff4eb] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[#d85300]">
                  <Flame className="h-3.5 w-3.5" />
                  Final drop
                </div>
                <div className="mt-2 line-clamp-2 min-h-[34px] text-[12px] font-semibold leading-4 text-[#222] sm:text-[14px] sm:leading-5">{product.title}</div>
                <div className="mt-2 text-[15px] font-black text-[#ff4d21] sm:text-[18px]">{formatPriceRange(pricing.formatPrice, product.minUsd, product.maxUsd)}</div>
                <div className="mt-1 text-[10px] text-[#777] sm:text-[11px]">MOQ {product.moq} {product.unit}</div>
              </Link>
            ))}
          </div>
        </section>
        </>
        ) : (
          <section className="rounded-[28px] bg-white px-6 py-8 text-center shadow-[0_18px_40px_rgba(17,24,39,0.06)] ring-1 ring-black/5 sm:px-8 sm:py-10">
            <h2 className="text-[28px] font-black tracking-[-0.05em] text-[#222]">Aucun deal flash publie</h2>
            <p className="mx-auto mt-3 max-w-[700px] text-[15px] leading-7 text-[#666]">
              Les articles de test ont ete retires. Les deals flash apparaitront ici quand tu auras importe puis publie tes propres produits Alibaba.
            </p>
            <Link href="/admin/alibaba-sourcing/import-catalog" className="mt-6 inline-flex h-12 items-center justify-center rounded-full bg-[#ff6a00] px-6 text-[15px] font-semibold text-white transition hover:bg-[#ec6100]">
              Importer des produits
            </Link>
          </section>
        )}
      </div>
    </InternalPageShell>
  );
}