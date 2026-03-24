"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Gem, Headphones, Shirt, Sparkles, Star, Dumbbell } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type ShowcaseCardItem = {
  title: string;
  image: string;
  price: string;
  href?: string;
};

type ExploreCard = {
  id: string;
  title: string;
  subtitle: string;
  items: ShowcaseCardItem[];
};

type BannerSlide = {
  id: string;
  image: string;
  alt: string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  buttonLabel: string;
  href: string;
};

type CategoryItem = {
  title: string;
  href?: string;
};

type HomeDiscoveryShowcaseProps = {
  categories?: CategoryItem[];
  historyCard?: ShowcaseCardItem;
  historyCards?: ShowcaseCardItem[];
  exploreCards?: ExploreCard[];
  slides?: BannerSlide[];
};

const categoryIcons = [Star, Shirt, Headphones, Dumbbell, Sparkles, Gem, Sparkles, Headphones];

const fallbackHistoryCard: ShowcaseCardItem = {
  title: "Produit recent",
  image: "https://s.alicdn.com/@sc04/kf/H097752b8b24344aebcabb135315e1a8d2.jpg_350x350.jpg",
  price: "--",
};

export function HomeDiscoveryShowcase({ categories = [], historyCard, historyCards, exploreCards = [], slides = [] }: HomeDiscoveryShowcaseProps) {
  const [activeSlide, setActiveSlide] = useState(0);
  const [activeHistoryIndex, setActiveHistoryIndex] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);
  const categoryContainerRef = useRef<HTMLDivElement | null>(null);
  const hasSlides = slides.length > 0;
  const hasCategoryPanel = categories.length > 0;
  const resolvedHistoryCards = historyCards && historyCards.length > 0 ? historyCards : [historyCard ?? fallbackHistoryCard];
  const resolvedHistoryCard = resolvedHistoryCards[activeHistoryIndex] ?? fallbackHistoryCard;
  const mobileArticleCards = [
    ...resolvedHistoryCards.map((item, index) => ({
      id: `history-${index}`,
      title: item.title,
      image: item.image,
      price: item.price,
      href: item.href,
      caption: "Historique",
    })),
    ...exploreCards.flatMap((card) =>
      card.items.map((item, index) => ({
        id: `${card.id}-${index}`,
        title: item.title,
        image: item.image,
        price: item.price,
        href: item.href,
        caption: card.title,
      })),
    ),
  ].slice(0, 12);

  useEffect(() => {
    const element = categoryContainerRef.current;

    if (!element) {
      return;
    }

    const updateScroll = () => {
      const maxScroll = element.scrollHeight - element.clientHeight;
      const nextProgress = maxScroll <= 0 ? 0 : element.scrollTop / maxScroll;
      setScrollProgress(nextProgress);
    };

    updateScroll();
    element.addEventListener("scroll", updateScroll, { passive: true });

    return () => element.removeEventListener("scroll", updateScroll);
  }, []);

  return (
    <section className="overflow-hidden bg-transparent px-0 py-0 shadow-none ring-0 sm:rounded-[26px] sm:bg-white sm:px-4 sm:py-4 sm:shadow-[0_12px_36px_rgba(24,39,75,0.06)] sm:ring-1 sm:ring-black/5">
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:hidden">
        {mobileArticleCards.map((item) => {
          const cardContent = (
            <>
              <div className="relative aspect-square w-full overflow-hidden rounded-[10px] bg-[#f3f3f3]">
                <Image src={item.image} alt={item.title} fill sizes="96px" className="object-cover" />
              </div>
              <div className="px-1 pb-1 pt-2">
                <div className="line-clamp-1 text-[9px] font-medium uppercase tracking-[0.08em] text-[#8a8a8a]">{item.caption}</div>
                <div className="mt-1 line-clamp-2 min-h-[28px] text-[11px] font-medium leading-[1.25] text-[#222]">{item.title}</div>
                <div className="mt-1.5 text-[12px] font-bold leading-none text-[#222]">{item.price}</div>
              </div>
            </>
          );

          if (item.href) {
            return (
              <Link
                key={item.id}
                href={item.href}
                className="w-[96px] shrink-0 rounded-[12px] bg-white p-1.5 shadow-[0_1px_0_rgba(0,0,0,0.03),0_10px_18px_rgba(17,24,39,0.06)] ring-1 ring-black/5"
              >
                {cardContent}
              </Link>
            );
          }

          return (
            <article
              key={item.id}
              className="w-[96px] shrink-0 rounded-[12px] bg-white p-1.5 shadow-[0_1px_0_rgba(0,0,0,0.03),0_10px_18px_rgba(17,24,39,0.06)] ring-1 ring-black/5"
            >
              {cardContent}
            </article>
          );
        })}
      </div>

      <div className={[
        "hidden sm:grid",
        "grid gap-2.5 xl:items-stretch",
        hasCategoryPanel
          ? hasSlides
            ? "xl:grid-cols-[minmax(220px,0.92fr)_minmax(250px,0.96fr)_minmax(220px,0.84fr)_minmax(220px,0.84fr)_minmax(300px,1.24fr)]"
            : "xl:grid-cols-[minmax(220px,0.98fr)_minmax(250px,1fr)_minmax(220px,0.88fr)_minmax(220px,0.88fr)]"
          : hasSlides
            ? "xl:grid-cols-[minmax(250px,1fr)_minmax(220px,0.9fr)_minmax(220px,0.9fr)_minmax(320px,1.18fr)]"
            : "xl:grid-cols-[minmax(240px,1.08fr)_minmax(185px,0.84fr)_minmax(185px,0.84fr)_minmax(185px,0.84fr)]",
      ].join(" ")}>
        {hasCategoryPanel ? (
          <article className="relative min-w-0 h-[260px] rounded-[22px] bg-[#fbfbfb] px-3 py-3 ring-1 ring-black/5 sm:h-[300px] xl:h-[318px]">
            <div
              ref={categoryContainerRef}
              className="max-h-[260px] overflow-y-auto pr-5 sm:max-h-[300px] xl:max-h-[318px]"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              <style>{`.hide-scrollbar::-webkit-scrollbar{display:none}`}</style>
              <div className="hide-scrollbar space-y-1">
                {categories.map((item, index) => {
                  const Icon = categoryIcons[index % categoryIcons.length];
                  const content = (
                    <>
                      <span className="flex items-center gap-3">
                        <Icon className="h-[18px] w-[18px] text-[#333]" />
                        <span className={["text-[14px] leading-6 text-[#2a2a2a]", index === 0 ? "font-semibold" : "font-medium"].join(" ")}>
                          {item.title}
                        </span>
                      </span>
                      <ChevronRight className="h-4 w-4 text-[#777]" />
                    </>
                  );

                  if (item.href) {
                    return (
                      <Link
                        key={`${item.title}-${index}`}
                        href={item.href}
                        className="flex w-full items-center justify-between rounded-[14px] px-3 py-3 text-left transition hover:bg-white"
                      >
                        {content}
                      </Link>
                    );
                  }

                  return (
                    <div key={`${item.title}-${index}`} className="flex w-full items-center justify-between rounded-[14px] px-3 py-3 text-left transition hover:bg-white">
                      {content}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="absolute bottom-4 right-3 top-4 w-[8px] rounded-full bg-[#ececec]">
              <div
                className="absolute left-0 right-0 h-[54px] rounded-full bg-[#808080] transition-transform duration-200"
                style={{ transform: `translateY(${scrollProgress * 212}px)` }}
              />
            </div>
          </article>
        ) : null}

        <article className="relative flex min-w-0 h-[248px] flex-col rounded-[20px] bg-[#f8f8f8] p-2.5 ring-1 ring-black/5 sm:h-[282px] xl:h-[292px]">
          <div className="text-[15px] font-bold leading-6 tracking-[-0.03em] text-[#222] sm:text-[17px]">
            Historique de recherche
          </div>
          <div className="relative mt-3 flex-1 overflow-hidden rounded-[16px] bg-white">
            {resolvedHistoryCard.href ? (
              <Link href={resolvedHistoryCard.href} className="absolute inset-0 z-[1] block" aria-label={resolvedHistoryCard.title}>
                <div className="relative h-full w-full">
                  <Image
                    key={`${resolvedHistoryCard.title}-${activeHistoryIndex}`}
                    src={resolvedHistoryCard.image}
                    alt={resolvedHistoryCard.title}
                    fill
                    sizes="(min-width: 1280px) 18vw, (min-width: 768px) 28vw, 90vw"
                    className="object-contain"
                  />
                </div>
              </Link>
            ) : (
              <div className="relative h-full w-full">
                <Image
                  key={`${resolvedHistoryCard.title}-${activeHistoryIndex}`}
                  src={resolvedHistoryCard.image}
                  alt={resolvedHistoryCard.title}
                  fill
                  sizes="(min-width: 1280px) 18vw, (min-width: 768px) 28vw, 90vw"
                  className="object-contain"
                />
              </div>
            )}
            <button
              type="button"
              onClick={() => setActiveHistoryIndex((current) => (current - 1 + resolvedHistoryCards.length) % resolvedHistoryCards.length)}
              className="absolute left-2.5 top-1/2 z-10 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[#333] shadow-[0_8px_18px_rgba(0,0,0,0.16)]"
            >
              <ChevronLeft className="h-4.5 w-4.5" />
            </button>
            <button
              type="button"
              onClick={() => setActiveHistoryIndex((current) => (current + 1) % resolvedHistoryCards.length)}
              className="absolute right-2.5 top-1/2 z-10 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[#333] shadow-[0_8px_18px_rgba(0,0,0,0.16)]"
            >
              <ChevronRight className="h-4.5 w-4.5" />
            </button>
            <div className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-white px-2.5 py-1 text-[14px] font-bold text-[#222] shadow-[0_8px_18px_rgba(0,0,0,0.12)]">
              {resolvedHistoryCard.price}
            </div>
          </div>
        </article>

        {exploreCards.map((card) => (
          <article key={card.id} className="flex min-w-0 h-[248px] flex-col rounded-[20px] bg-[#f8f8f8] p-2.5 ring-1 ring-black/5 sm:h-[282px] xl:h-[292px]">
            <div className="text-[15px] font-bold leading-5 tracking-[-0.03em] text-[#222]">{card.title}</div>
            <div className="min-h-[30px] text-[10px] leading-[1.3] text-[#707070]">{card.subtitle}</div>
            <div className="mt-2.5 grid flex-1 grid-cols-2 gap-2">
              {card.items.map((item) => (
                <div key={item.title} className="relative overflow-hidden rounded-[14px] bg-white">
                  <div className="relative h-full min-h-[100px] w-full">
                    {item.href ? (
                      <Link href={item.href} className="absolute inset-0 block" aria-label={item.title}>
                        <Image src={item.image} alt={item.title} fill sizes="(min-width: 1280px) 10vw, (min-width: 768px) 18vw, 40vw" className="object-contain" />
                      </Link>
                    ) : (
                      <Image src={item.image} alt={item.title} fill sizes="(min-width: 1280px) 10vw, (min-width: 768px) 18vw, 40vw" className="object-contain" />
                    )}
                  </div>
                  <div className="absolute bottom-1.5 left-1.5 rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-[#222] shadow-[0_8px_18px_rgba(0,0,0,0.12)]">
                    {item.price}
                  </div>
                </div>
              ))}
            </div>
          </article>
        ))}

        {hasSlides ? (
          <article className="relative min-w-0 min-h-[260px] overflow-hidden rounded-[22px] bg-[#d8e3f5] ring-1 ring-[#d4e0f0] sm:min-h-[300px] xl:min-h-[318px]">
            {slides.map((slide, index) => (
              <div
                key={slide.id}
                className={[
                  "absolute inset-0 transition-opacity duration-500",
                  activeSlide === index ? "opacity-100" : "pointer-events-none opacity-0",
                ].join(" ")}
              >
                <div className="absolute inset-0 z-[1] bg-[linear-gradient(180deg,rgba(7,18,44,0.66)_0%,rgba(7,18,44,0.34)_24%,rgba(7,18,44,0.22)_58%,rgba(7,18,44,0.52)_100%)]" />
                <div className="relative h-full min-h-[260px] sm:min-h-[300px] xl:min-h-[318px]">
                  <Image src={slide.image} alt={slide.alt} fill sizes="(min-width: 1280px) 26vw, (min-width: 768px) 38vw, 92vw" className="object-cover" />
                  <div className="absolute inset-x-0 top-5 z-10 px-5 text-center">
                    {slide.eyebrow ? <div className="text-[14px] font-semibold tracking-[-0.02em] text-white/90">{slide.eyebrow}</div> : null}
                    <div className="mx-auto mt-1 max-w-[320px] text-[24px] font-black leading-[1.02] tracking-[-0.05em] text-white drop-shadow-[0_8px_18px_rgba(0,0,0,0.4)] sm:text-[32px]">
                      {slide.title}
                    </div>
                    {slide.subtitle ? <div className="mx-auto mt-2 max-w-[300px] text-[13px] leading-5 font-medium text-white/90">{slide.subtitle}</div> : null}
                  </div>
                  <div className="absolute bottom-7 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-4">
                    <Link href={slide.href} className="inline-flex h-11 min-w-[180px] items-center justify-center rounded-full bg-[#10245c] px-6 text-[14px] font-semibold text-white shadow-[0_10px_24px_rgba(16,36,92,0.28)] transition hover:bg-[#0b1d4f] sm:h-12 sm:min-w-[210px] sm:px-10 sm:text-[15px]">
                      {slide.buttonLabel}
                    </Link>
                    <div className="flex items-center gap-2 rounded-full bg-black/18 px-3 py-2 backdrop-blur-sm">
                      {slides.map((dotSlide, dotIndex) => (
                        <button
                          key={dotSlide.id}
                          type="button"
                          onClick={() => setActiveSlide(dotIndex)}
                          className={[
                            "h-2.5 rounded-full transition-all",
                            activeSlide === dotIndex ? "w-5 bg-white" : "w-2.5 bg-white/55",
                          ].join(" ")}
                          aria-label={`Aller au slide ${dotIndex + 1}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </article>
        ) : null}
      </div>
    </section>
  );
}