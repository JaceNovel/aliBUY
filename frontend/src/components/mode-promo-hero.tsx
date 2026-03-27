"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Gift } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { LiveCountdownBadge } from "@/components/live-countdown-badge";

type PromoHeroSlide = {
  id: string;
  deadlinePrefix: string;
  endsAt: string;
  headline: string;
  spotlightTitle: string;
  spotlightPrice: string;
  spotlightHref: string;
  spotlightImage: string;
  accentColor: string;
  coupons: Array<{
    value: string;
    limit: string;
    code: string;
  }>;
};

type ModePromoHeroProps = {
  slides: PromoHeroSlide[];
};

export function ModePromoHero({ slides }: ModePromoHeroProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const pointerStartX = useRef<number | null>(null);

  const showPrevious = useCallback(() => {
    setActiveIndex((current) => (current - 1 + slides.length) % slides.length);
  }, [slides.length]);

  const showNext = useCallback(() => {
    setActiveIndex((current) => (current + 1) % slides.length);
  }, [slides.length]);

  useEffect(() => {
    if (slides.length <= 1) {
      return;
    }

    const timer = window.setInterval(() => {
      showNext();
    }, 4200);

    return () => window.clearInterval(timer);
  }, [showNext, slides.length]);

  return (
    <section
      className="relative overflow-hidden rounded-[22px] bg-[#ff0a68] text-white shadow-[0_18px_40px_rgba(255,10,104,0.24)] sm:rounded-[32px] sm:shadow-[0_28px_70px_rgba(255,10,104,0.32)]"
      onPointerDown={(event) => {
        pointerStartX.current = event.clientX;
      }}
      onPointerUp={(event) => {
        if (pointerStartX.current === null) {
          return;
        }

        const delta = event.clientX - pointerStartX.current;
        pointerStartX.current = null;

        if (Math.abs(delta) < 40) {
          return;
        }

        if (delta < 0) {
          showNext();
          return;
        }

        showPrevious();
      }}
      onPointerLeave={() => {
        pointerStartX.current = null;
      }}
    >
      {slides.map((slide, index) => {
        const isActive = index === activeIndex;

        return (
          <div
            key={slide.id}
            className={[
              "grid gap-0 transition-all duration-700 xl:grid-cols-[1.15fr_0.85fr]",
              isActive ? "relative opacity-100" : "pointer-events-none absolute inset-0 opacity-0",
            ].join(" ")}
            aria-hidden={!isActive}
          >
            <div className="px-4 py-4 sm:px-8 lg:px-10 lg:py-8">
              <LiveCountdownBadge
                endsAt={slide.endsAt}
                prefix={slide.deadlinePrefix}
                className="inline-flex items-center gap-2 rounded-full bg-white/14 px-3 py-1.5 text-[12px] font-bold tracking-[-0.03em] text-white/95 ring-1 ring-white/18 backdrop-blur-sm sm:gap-3 sm:px-4 sm:py-2 sm:text-[16px]"
                iconClassName="h-4 w-4 sm:h-5 sm:w-5"
              />
              <div className="mt-3 flex items-center gap-3 sm:gap-4">
                <h1 className="text-[30px] font-black uppercase tracking-[-0.06em] sm:text-[68px]">{slide.headline}</h1>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#ff0a68] sm:h-12 sm:w-12">
                  <ChevronRight className="h-5 w-5 sm:h-7 sm:w-7" />
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:mt-7 sm:gap-4 lg:grid-cols-[1.45fr_0.75fr]">
                <div className="grid gap-0 rounded-[16px] border-[3px] border-white bg-white text-[#ff0a68] sm:rounded-[18px] sm:border-[4px] sm:grid-cols-3">
                  {slide.coupons.map((coupon, couponIndex) => (
                    <div key={coupon.code} className={["relative px-3 py-3 text-center sm:px-4 sm:py-5", couponIndex < slide.coupons.length - 1 ? "border-b border-[#ffd7e7] sm:border-b-0 sm:border-r" : ""].join(" ")}>
                      <div className="text-[16px] font-black sm:text-[30px]">{coupon.value}</div>
                      <div className="mt-1 text-[11px] text-[#ff7aa9] sm:text-[15px]">{coupon.limit}</div>
                      <div className="mt-2 text-[12px] font-bold sm:mt-4 sm:text-[16px]">Code:{coupon.code}</div>
                    </div>
                  ))}
                </div>

                <Link href={slide.spotlightHref} className="group relative grid min-h-[132px] grid-cols-[92px_1fr] overflow-hidden rounded-[18px] bg-[linear-gradient(135deg,#c6def9_0%,#b8d2f4_100%)] text-[#0f416e] ring-1 ring-white/35 transition hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(15,65,110,0.16)] sm:min-h-[170px] sm:grid-cols-[132px_1fr] sm:rounded-[22px]">
                  <div className="relative m-3 overflow-hidden rounded-[14px] bg-white/72 shadow-[0_14px_26px_rgba(255,255,255,0.24)] sm:m-4 sm:rounded-[18px]">
                    <Image src={slide.spotlightImage} alt={slide.spotlightTitle} fill sizes="160px" className="object-contain p-3 transition-transform duration-300 group-hover:scale-[1.04]" />
                  </div>
                  <div className="flex flex-col justify-between px-2 py-3 pr-3 sm:px-3 sm:py-4 sm:pr-4">
                    <div>
                      <div className="inline-flex rounded-full bg-white/55 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.1em] text-[#275784] sm:px-3 sm:text-[11px] sm:tracking-[0.14em]">
                        Spotlight deal
                      </div>
                      <div className="mt-2 line-clamp-2 text-[14px] font-black leading-5 tracking-[-0.04em] text-[#22537d] sm:mt-3 sm:text-[18px] sm:leading-7">
                        {slide.spotlightTitle}
                      </div>
                    </div>
                    <div className="flex items-end justify-between gap-3">
                      <div className="inline-flex items-center rounded-[10px] bg-[#4c617a] px-2.5 py-1.5 text-[12px] font-black text-white shadow-[0_10px_20px_rgba(34,53,74,0.18)] sm:px-3 sm:py-2 sm:text-[16px]">
                        {slide.spotlightPrice}
                      </div>
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#2d5a83] shadow-[0_10px_20px_rgba(34,53,74,0.12)] transition-transform duration-300 group-hover:translate-x-0.5 sm:h-10 sm:w-10">
                        <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            </div>

            <div className="relative hidden overflow-hidden xl:block">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_65%,rgba(255,188,215,0.35),transparent_32%),radial-gradient(circle_at_70%_24%,rgba(255,255,255,0.18),transparent_28%)]" />
              <div className="relative flex h-full items-end justify-center px-10 py-8">
                <div className="relative w-full max-w-[450px]">
                  <div className="absolute right-2 top-0 text-[62px] font-black tracking-[-0.08em] text-white">16<span className="text-[30px] align-top">ème</span></div>
                  <div className="absolute right-0 top-0 h-28 w-28 rounded-[8px] bg-[#46b7f2] shadow-[0_18px_30px_rgba(0,0,0,0.12)]" />
                  <div className="absolute right-24 top-9 h-20 w-24 rounded-[8px] bg-[repeating-linear-gradient(135deg,#ffdc4c_0_10px,#ff89cc_10px_20px)]" />
                  <div className="absolute right-[170px] top-6 flex h-20 w-24 items-center justify-center rounded-[12px] bg-[#ffd70f] text-[#ff0a68] shadow-[0_14px_26px_rgba(0,0,0,0.12)]">
                    <Gift className="h-10 w-10" />
                  </div>
                  <div className="relative mt-24 rounded-[10px] bg-black px-8 py-8 text-white shadow-[0_28px_48px_rgba(0,0,0,0.18)]">
                    <div className="text-[82px] font-black uppercase leading-[0.9] tracking-[-0.08em]">Promo</div>
                    <div className="mt-3 text-[54px] font-black uppercase leading-[0.95] tracking-[-0.08em]" style={{ color: slide.accentColor }}>Anniversaire</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      <button
        type="button"
        aria-label="Slide précédente"
        className="absolute left-5 top-1/2 z-20 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/18 text-white ring-1 ring-white/18 backdrop-blur-sm transition hover:bg-white/28 xl:flex"
        onClick={showPrevious}
      >
        <ChevronLeft className="h-6 w-6" />
      </button>

      <button
        type="button"
        aria-label="Slide suivante"
        className="absolute right-5 top-1/2 z-20 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/18 text-white ring-1 ring-white/18 backdrop-blur-sm transition hover:bg-white/28 xl:flex"
        onClick={showNext}
      >
        <ChevronRight className="h-6 w-6" />
      </button>

      <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center justify-center gap-2 sm:bottom-6 sm:gap-3">
        {slides.map((slide, index) => (
          <button
            key={slide.id}
            type="button"
            aria-label={`Afficher la slide ${index + 1}`}
            className={[
              "h-[5px] rounded-full transition-all duration-300 sm:h-[6px]",
              index === activeIndex ? "w-7 bg-white sm:w-10" : "w-7 bg-white/45 hover:bg-white/70 sm:w-10",
            ].join(" ")}
            onClick={() => setActiveIndex(index)}
          />
        ))}
      </div>
    </section>
  );
}