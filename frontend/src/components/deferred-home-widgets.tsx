"use client";

import dynamic from "next/dynamic";

import type { CategoryMegaMenuCategory } from "@/components/category-mega-menu";

const CountryPreferenceModal = dynamic(() => import("@/components/country-preference-modal").then((module) => module.CountryPreferenceModal), { ssr: false });
const ScrollNavbar = dynamic(() => import("@/components/scroll-navbar").then((module) => module.ScrollNavbar), { ssr: false });
const MobileBottomNav = dynamic(() => import("@/components/mobile-bottom-nav").then((module) => module.MobileBottomNav), { ssr: false });

type DeferredHomeWidgetsProps = {
  countryCode: string;
  countryLabel: string;
  currencyCode: string;
  flagEmoji: string;
  languageCode: string;
  languageLabel: string;
  categories: CategoryMegaMenuCategory[];
};

export function DeferredHomeWidgets({
  countryCode,
  countryLabel,
  currencyCode,
  flagEmoji,
  languageCode,
  languageLabel,
  categories,
}: DeferredHomeWidgetsProps) {
  return (
    <>
      <CountryPreferenceModal countryCode={countryCode} currencyCode={currencyCode} />
      <ScrollNavbar
        countryCode={countryCode}
        countryLabel={countryLabel}
        currencyCode={currencyCode}
        flagEmoji={flagEmoji}
        languageCode={languageCode}
        languageLabel={languageLabel}
        user={null}
        categories={categories}
      />
      <MobileBottomNav />
    </>
  );
}