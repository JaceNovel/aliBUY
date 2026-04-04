"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import { CategoryMegaMenu, type CategoryMegaMenuCategory } from "@/components/category-mega-menu";
import { DeliveryAddressPopover } from "@/components/delivery-address-popover";
import { HeaderActionGroup } from "@/components/header-action-group";
import { LanguageSelectorPopover } from "@/components/language-selector-popover";
import { OrderProtectionMenu } from "@/components/order-protection-menu";
import { SupportMenu } from "@/components/support-menu";
import { UnavailableLink } from "@/components/unavailable-link";
import { getMessages } from "@/lib/messages";
import { SITE_LOGO_PATH, SITE_NAME } from "@/lib/site-config";

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
      <div className="mx-auto max-w-[1880px] px-4 lg:px-6 xl:px-8">
        <div className="flex min-h-[64px] items-center justify-between gap-3 border-b border-[#dadada] sm:min-h-[78px] xl:gap-5 2xl:gap-6">
          <div className="flex min-w-0 flex-1 items-center gap-4 xl:gap-6 2xl:gap-10">
            <Link href="/" className="inline-flex shrink-0 items-center gap-2.5 text-[#ff6a00] xl:gap-3">
              <Image src={SITE_LOGO_PATH} alt={`${SITE_NAME} logo`} width={44} height={44} className="h-10 w-10 object-contain sm:h-11 sm:w-11" priority />
              <span className="text-[20px] font-bold tracking-[-0.05em] sm:text-[24px] 2xl:text-[28px]">AfriPay</span>
            </Link>
            <nav className="hidden min-w-0 flex-1 items-center gap-3 text-[14px] font-medium text-[#222] xl:flex xl:gap-4 2xl:gap-8 2xl:text-[16px]">
              <CategoryMegaMenu
                categories={categories}
                languageCode={languageCode}
                triggerClassName="inline-flex h-[78px] min-w-0 shrink items-center gap-2 border-b-2 border-transparent pr-2 whitespace-nowrap hover:border-[#222] xl:max-w-[260px] 2xl:max-w-none"
                widthClassName="w-[min(1220px,calc(100vw-48px))]"
              />
              <OrderProtectionMenu
                languageCode={languageCode}
                triggerClassName="inline-flex h-[78px] min-w-0 items-center border-b-2 border-transparent whitespace-nowrap hover:border-[#222]"
                widthClassName="w-[min(1120px,calc(100vw-48px))]"
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

          <div className="hidden shrink-0 items-center gap-4 xl:flex 2xl:gap-7">
            <DeliveryAddressPopover
              countryCode={countryCode}
              countryLabel={countryLabel}
              currencyCode={currencyCode}
              flagEmoji={flagEmoji}
              languageCode={languageCode}
              align="center"
            />

            <LanguageSelectorPopover languageCode={languageCode} languageLabel={languageLabel} />

            <HeaderActionGroup className="flex items-center gap-4 text-[#222] 2xl:gap-6" iconClassName="h-5 w-5 2xl:h-6 2xl:w-6" user={user} />
          </div>
        </div>

        <div className="hidden min-h-[50px] items-center justify-between gap-6 border-t border-[#efefef] text-[15px] text-[#222] xl:flex 2xl:min-h-[54px] 2xl:text-[16px]">
          <div />
          <div className="flex items-center gap-6 2xl:gap-10">
            <SupportMenu triggerLabel={messages.nav.support} className="transition hover:text-[#ff6a00]" />
            <UnavailableLink label={messages.nav.appExtension} message={messages.unavailable.message} className="text-[15px] text-[#222] 2xl:text-[16px]" />
          </div>
        </div>
      </div>
    </div>
  );
}
