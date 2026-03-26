"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Bolt, Clock3, Flame } from "lucide-react";

type HeroDeal = {
  slug: string;
  title: string;
  image: string;
  price: string;
  compareAt: string;
};

export function DealsFlashHero({
  deals,
}: {
  deals: HeroDeal[];
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (deals.length <= 1) {
      return;
    }

    const interval = window.setInterval(() => {
      setIsVisible(false);

      window.setTimeout(() => {
        setActiveIndex((current) => (current + 1) % deals.length);
        setIsVisible(true);
      }, 220);
    }, 3200);

    return () => {
      window.clearInterval(interval);
    };
  }, [deals.length]);

  const activeDeal = deals[activeIndex] ?? deals[0];

  return (
    <section className="overflow-hidden rounded-[24px] bg-[linear-gradient(135deg,#20110d_0%,#6d281b_52%,#ff6a00_100%)] text-white shadow-[0_18px_40px_rgba(109,46,16,0.22)] sm:rounded-[30px]">
      <div className="grid min-h-[240px] gap-4 px-4 py-4 sm:min-h-[280px] sm:px-6 sm:py-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:px-8 lg:py-7">
        <div className="flex min-w-0 flex-col justify-center">
          <div className="inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-white/84 ring-1 ring-white/12 sm:text-[11px]">
            <Bolt className="h-4 w-4" />
            Centre deals flash
          </div>
          <h1 className="mt-3 max-w-[680px] text-[25px] font-black tracking-[-0.06em] sm:text-[34px] lg:text-[42px]">
            Tous les deals flash sur une seule ligne, en version plus compacte.
          </h1>
          <p className="mt-3 max-w-[640px] text-[13px] leading-6 text-white/84 sm:text-[14px] sm:leading-7">
            Une banniere plus fine, plus propre, avec une offre mise en avant qui tourne automatiquement pour garder la page vivante.
          </p>

          <div className="mt-4 flex flex-wrap gap-2.5 sm:mt-5 sm:gap-3">
            <Link href="#selection-flash" className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#ffd9c2] px-5 text-[13px] font-extrabold text-[#5a240d] shadow-[0_10px_24px_rgba(0,0,0,0.12)] transition hover:bg-[#ffc59f]">
              Voir les deals
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/products" className="inline-flex h-11 items-center justify-center rounded-full border border-white/20 bg-white/10 px-5 text-[13px] font-bold text-white transition hover:bg-white/16">
              Retour au catalogue
            </Link>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 sm:mt-5 sm:max-w-[520px]">
            {[
              { label: "Deals live", value: String(deals.length) },
              { label: "Rotation", value: "Auto" },
              { label: "Format", value: "Compact" },
            ].map((item) => (
              <div key={item.label} className="rounded-[16px] bg-white/10 px-3 py-3 ring-1 ring-white/12 backdrop-blur-sm">
                <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-white/68 sm:text-[10px]">{item.label}</div>
                <div className="mt-1 text-[15px] font-black tracking-[-0.04em] text-white sm:text-[18px]">{item.value}</div>
              </div>
            ))}
          </div>
        </div>

        {activeDeal ? (
          <Link
            href={`/products/${activeDeal.slug}`}
            className="group relative flex h-full min-h-[220px] min-w-0 overflow-hidden rounded-[20px] bg-white/10 p-3 ring-1 ring-white/14 backdrop-blur-sm transition hover:bg-white/14 sm:rounded-[24px] sm:p-4"
          >
            <div className="grid h-full w-full gap-3 sm:grid-cols-[170px_minmax(0,1fr)] sm:items-center">
              <div className="relative min-h-[130px] overflow-hidden rounded-[16px] bg-white/90 sm:h-[170px] sm:min-h-0 sm:rounded-[18px]">
                <Image
                  key={activeDeal.slug}
                  src={activeDeal.image}
                  alt={activeDeal.title}
                  fill
                  sizes="(min-width: 1024px) 26vw, 92vw"
                  className={[
                    "object-cover transition-all duration-500 group-hover:scale-[1.04]",
                    isVisible ? "translate-x-0 scale-100 opacity-100" : "translate-x-4 scale-[1.03] opacity-0",
                  ].join(" ")}
                />
              </div>

              <div
                className={[
                  "min-w-0 self-end transition-all duration-500 sm:self-center",
                  isVisible ? "translate-x-0 opacity-100" : "translate-x-3 opacity-0",
                ].join(" ")}
              >
                <div className="inline-flex items-center gap-1 rounded-full bg-[#ffb36b] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-[#59250d]">
                  <Flame className="h-3.5 w-3.5" />
                  Spotlight
                </div>
                <div className="mt-2 line-clamp-3 text-[18px] font-black leading-6 tracking-[-0.05em] text-white sm:text-[24px] sm:leading-7">
                  {activeDeal.title}
                </div>
                <div className="mt-2 flex items-end gap-2">
                  <span className="text-[20px] font-black text-white sm:text-[26px]">{activeDeal.price}</span>
                  <span className="text-[12px] text-white/66 line-through sm:text-[14px]">{activeDeal.compareAt}</span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-2 rounded-full bg-[#ff9f1a] px-3 py-1.5 text-[11px] font-bold text-white shadow-[0_12px_24px_rgba(255,159,26,0.28)]">
                    <Clock3 className="h-4 w-4" />
                    Offre limitee
                  </div>
                  <div className="flex items-center gap-1.5">
                    {deals.map((deal, index) => (
                      <span
                        key={deal.slug}
                        className={[
                          "h-2.5 rounded-full transition-all",
                          index === activeIndex ? "w-6 bg-white" : "w-2.5 bg-white/40",
                        ].join(" ")}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </Link>
        ) : null}
      </div>
    </section>
  );
}
