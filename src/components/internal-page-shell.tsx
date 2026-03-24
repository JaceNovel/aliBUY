import { Camera, Search } from "lucide-react";
import Link from "next/link";

import { AboutMenu } from "@/components/about-menu";
import { CategoryMegaMenu } from "@/components/category-mega-menu";
import { DeliveryAddressPopover } from "@/components/delivery-address-popover";
import { HeaderActionGroup } from "@/components/header-action-group";
import { LanguageSelectorPopover } from "@/components/language-selector-popover";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { OrderProtectionMenu } from "@/components/order-protection-menu";
import { SearchSuggestionInput } from "@/components/search-suggestion-input";
import { SupportMenu } from "@/components/support-menu";
import { UnavailableLink } from "@/components/unavailable-link";
import { getCurrentUser } from "@/lib/user-auth";
import { getMessages } from "@/lib/messages";

type InternalPageShellProps = {
  pricing: {
    countryCode: string;
    countryLabel: string;
    currency: { code: string };
    flagEmoji: string;
    languageCode: string;
    languageLabel: string;
  };
  children: React.ReactNode;
};

export async function InternalPageShell({ pricing, children }: InternalPageShellProps) {
  const messages = getMessages(pricing.languageCode);
  const user = await getCurrentUser();

  return (
    <main className="min-h-screen overflow-x-clip bg-[#f7f7f7] pb-24 text-[#222] md:pb-0">
      <header className="border-b border-[#e5e5e5] bg-white">
        <div className="mx-auto max-w-[1680px] px-4 sm:px-6 xl:px-10">
          <div className="xl:hidden">
            <div className="flex items-center justify-between gap-3 border-b border-[#f0ebe6] py-3 text-[12px] font-semibold text-[#3a312c]">
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
              <Link href="/" className="text-[26px] font-bold tracking-[-0.06em] text-[#ff6a00]">
                AfriPay
              </Link>
            </div>

            <form action="/products" className="pb-3">
              <div className="flex items-center gap-2 rounded-[16px] border border-[#ddd6d0] bg-[#fffdfa] p-2 shadow-[0_8px_20px_rgba(17,24,39,0.05)]">
                <SearchSuggestionInput
                  name="q"
                  placeholder="Rechercher un produit"
                  wrapperClassName="relative min-w-0 flex-1"
                  inputClassName="h-10 w-full rounded-[12px] border border-[#ece6df] bg-[#f9f7f4] px-3 text-[13px] text-[#222] outline-none placeholder:text-[#8a8179] focus:border-[#ff6a00]"
                  panelClassName="absolute left-0 right-0 top-[calc(100%+12px)] z-30 rounded-[20px] border border-black/5 bg-white p-4 shadow-[0_24px_48px_rgba(17,24,39,0.16)]"
                />
                <button
                  type="submit"
                  className="inline-flex h-10 shrink-0 items-center justify-center rounded-[12px] bg-[#222] px-4 text-[13px] font-semibold text-white transition hover:bg-black"
                >
                  <Search className="h-4 w-4" />
                </button>
              </div>
            </form>

          </div>

          <div className="hidden min-h-[74px] flex-col gap-3 py-3 xl:flex xl:flex-row xl:items-center xl:justify-between">
            <Link href="/" className="text-[24px] font-bold tracking-[-0.05em] text-[#ff6a00] sm:text-[30px]">
              AfriPay
            </Link>

            <form action="/products" className="order-last w-full xl:order-none xl:max-w-[860px] xl:flex-1 xl:px-4">
              <div className="flex items-center gap-2 rounded-[22px] border border-[#d9d9d9] bg-white px-2 py-2 shadow-[0_8px_24px_rgba(17,24,39,0.04)] sm:rounded-full">
                <SearchSuggestionInput
                  name="q"
                  placeholder="Que recherchez-vous ?"
                  wrapperClassName="relative min-w-0 flex-1"
                  inputClassName="h-10 w-full rounded-full bg-transparent px-3 text-[14px] text-[#222] outline-none placeholder:text-[#777] sm:h-11 sm:px-4 sm:text-[16px]"
                  panelClassName="absolute left-0 right-0 top-[calc(100%+12px)] z-30 rounded-[24px] border border-black/5 bg-white p-4 shadow-[0_24px_48px_rgba(17,24,39,0.16)]"
                />
                <button
                  type="button"
                  aria-label="Recherche par image"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] text-[#333] transition hover:bg-[#f5f5f5] sm:h-11 sm:w-11"
                >
                  <Camera className="h-5 w-5" />
                </button>
                <button
                  type="submit"
                  className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full bg-[#ff6a00] px-4 text-[14px] font-bold text-white transition hover:bg-[#eb6200] sm:h-11 sm:px-5 sm:text-[16px]"
                >
                  <Search className="h-4 w-4" />
                  <span className="hidden sm:inline">Rechercher</span>
                </button>
              </div>
            </form>

            <div className="flex flex-wrap items-center gap-3 text-[14px] text-[#222] sm:gap-4">
              <DeliveryAddressPopover
                countryCode={pricing.countryCode}
                countryLabel={pricing.countryLabel}
                currencyCode={pricing.currency.code}
                flagEmoji={pricing.flagEmoji}
                languageCode={pricing.languageCode}
                compact
                align="right"
              />
              <div className="hidden sm:block">
                <LanguageSelectorPopover languageCode={pricing.languageCode} languageLabel={pricing.languageLabel} align="right" />
              </div>
              <HeaderActionGroup className="flex items-center gap-3 text-[#222] sm:gap-4" iconClassName="h-5 w-5 sm:h-6 sm:w-6" user={user ? { displayName: user.displayName, firstName: user.firstName } : null} />
            </div>
          </div>

          <div className="border-t border-[#efefef] py-3 text-[15px]">
            <div className="hidden xl:flex xl:flex-row xl:items-center xl:justify-between">
              <nav className="flex flex-wrap items-center gap-x-8 gap-y-2 text-[#222]">
              <CategoryMegaMenu languageCode={pricing.languageCode} triggerClassName="inline-flex items-center gap-2 py-1 font-medium" panelClassName="top-[calc(100%+12px)]" widthClassName="w-[1360px]" />
              <Link href="/pricing" className="font-medium text-[#444] transition hover:text-[#ff6a00]">Tarifs</Link>
              <OrderProtectionMenu languageCode={pricing.languageCode} triggerClassName="inline-flex items-center py-1 font-medium text-[#444]" panelClassName="top-[calc(100%+12px)]" widthClassName="w-[1120px]" />
              </nav>
              <nav className="flex flex-wrap items-center gap-x-8 gap-y-2 text-[#444]">
                <AboutMenu triggerLabel={messages.nav.about} className="transition hover:text-[#ff6a00]" align="left" />
                <SupportMenu triggerLabel={messages.nav.support} className="transition hover:text-[#ff6a00]" />
                <UnavailableLink label={messages.nav.appExtension} message={messages.unavailable.message} className="text-[#444]" tooltipClassName="left-1/2 top-[calc(100%+12px)] -translate-x-1/2" />
              </nav>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1680px] px-4 py-5 sm:px-6 sm:py-8 xl:px-10">{children}</div>
      <MobileBottomNav />
    </main>
  );
}