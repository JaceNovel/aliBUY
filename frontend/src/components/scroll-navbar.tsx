"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AboutMenu } from "@/components/about-menu";
import { CategoryMegaMenu, type CategoryMegaMenuCategory } from "@/components/category-mega-menu";
import { DeliveryAddressPopover } from "@/components/delivery-address-popover";
import { HeaderActionGroup } from "@/components/header-action-group";
import { LanguageSelectorPopover } from "@/components/language-selector-popover";
import { OrderProtectionMenu } from "@/components/order-protection-menu";
import { SupportMenu } from "@/components/support-menu";
import { UnavailableLink } from "@/components/unavailable-link";
import { getMessages } from "@/lib/messages";

type ScrollNavbarProps = {
  countryCode: string;
  countryLabel: string;
  currencyCode: string;
  flagEmoji: string;
  languageCode: string;
  languageLabel: string;
  user?: {
    displayName: string;
    firstName: string;
  } | null;
  categories?: CategoryMegaMenuCategory[];
};

export function ScrollNavbar({ countryCode, countryLabel, currencyCode, flagEmoji, languageCode, languageLabel, user = null, categories = [] }: ScrollNavbarProps) {
  const [isVisible, setIsVisible] = useState(false);
  const messages = getMessages(languageCode);

  useEffect(() => {
    const onScroll = () => {
      setIsVisible(window.scrollY > 180);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={[
        "fixed inset-x-0 top-0 z-[60] bg-white/98 backdrop-blur transition-all duration-300",
        isVisible ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-full opacity-0",
      ].join(" ")}
    >
      <div className="mx-auto max-w-[1880px] px-5 lg:px-8">
        <div className="flex min-h-[64px] items-center justify-between gap-4 border-b border-[#dadada] sm:min-h-[78px] sm:gap-6">
          <div className="flex min-w-0 items-center gap-4 sm:gap-10">
            <Link href="/" className="shrink-0 text-[20px] font-bold tracking-[-0.05em] text-[#ff6a00] sm:text-[28px]">
              AfriPay
            </Link>
            <nav className="hidden items-center gap-10 text-[16px] font-medium text-[#222] xl:flex">
              <CategoryMegaMenu categories={categories} languageCode={languageCode} triggerClassName="inline-flex h-[78px] items-center gap-3 border-b-2 border-transparent pr-2 hover:border-[#222]" />
              <OrderProtectionMenu
                languageCode={languageCode}
                triggerClassName="inline-flex h-[78px] items-center border-b-2 border-transparent hover:border-[#222]"
                widthClassName="w-[1120px]"
              />
            </nav>
          </div>

          <div className="flex min-w-0 items-center gap-2 xl:hidden">
            <div className="hidden min-w-0 rounded-full bg-[#f8f3ee] px-3 py-2 text-[11px] font-semibold text-[#3b312a] sm:block">
              {flagEmoji} {countryCode}
            </div>
            <Link href="/products" className="rounded-full bg-[#f5f5f5] px-3 py-2 text-[12px] font-semibold text-[#222] transition hover:bg-[#ededed]">
              Catalogue
            </Link>
          </div>

          <div className="hidden items-center gap-7 xl:flex">
            <DeliveryAddressPopover
              countryCode={countryCode}
              countryLabel={countryLabel}
              currencyCode={currencyCode}
              flagEmoji={flagEmoji}
              languageCode={languageCode}
              align="center"
            />

            <LanguageSelectorPopover languageCode={languageCode} languageLabel={languageLabel} />

            <HeaderActionGroup className="flex items-center gap-6 text-[#222]" iconClassName="h-6 w-6" user={user} />
          </div>
        </div>

        <div className="hidden min-h-[54px] items-center justify-between gap-6 border-t border-[#efefef] text-[16px] text-[#222] xl:flex">
          <div className="flex items-center gap-10">
            <AboutMenu triggerLabel={messages.nav.about} className="transition hover:text-[#ff6a00]" align="right" />
          </div>
          <div className="flex items-center gap-10">
            <SupportMenu triggerLabel={messages.nav.support} className="transition hover:text-[#ff6a00]" />
            <UnavailableLink label={messages.nav.appExtension} message={messages.unavailable.message} className="text-[16px] text-[#222]" />
          </div>
        </div>
      </div>
    </div>
  );
}