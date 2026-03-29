"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { COUNTRY_CONFIG, CURRENCY_OPTIONS, DELIVERY_COUNTRY_OPTIONS, type CountryCode, type CurrencyCode } from "@/lib/pricing-options";

type CountryPreferenceModalProps = {
  countryCode: string;
  currencyCode: string;
};

const DISMISS_COOKIE = "afri_country_prompt_dismissed";

function readCookie(name: string) {
  if (typeof document === "undefined") {
    return undefined;
  }

  const target = `${name}=`;
  return document.cookie
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(target))
    ?.slice(target.length);
}

function writeCookie(name: string, value: string, maxAgeDays: number) {
  document.cookie = `${name}=${value}; Max-Age=${60 * 60 * 24 * maxAgeDays}; Path=/; SameSite=Lax`;
}

export function CountryPreferenceModal({ countryCode, currencyCode }: CountryPreferenceModalProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>(countryCode as CountryCode);
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode>(currencyCode as CurrencyCode);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setSelectedCountry(countryCode as CountryCode);
  }, [countryCode]);

  useEffect(() => {
    setSelectedCurrency(currencyCode as CurrencyCode);
  }, [currencyCode]);

  useEffect(() => {
    const savedCountry = readCookie("afri_country");
    const dismissed = readCookie(DISMISS_COOKIE);
    if (!savedCountry && !dismissed) {
      setIsOpen(true);
    }
  }, []);

  const countryDescription = useMemo(() => {
    if (["TG", "BJ", "GH", "CI", "BF"].includes(selectedCountry)) {
      return "Pour ce pays, AfriPay utilisera automatiquement ses adresses internes air ou mer pour le sourcing groupé.";
    }

    return "Pour ce pays, les commandes compatibles partent directement vers l'adresse client quand AliExpress dessert la destination.";
  }, [selectedCountry]);

  const handleCountryChange = (nextCountry: string) => {
    const normalizedCountry = nextCountry as CountryCode;
    setSelectedCountry(normalizedCountry);
    setSelectedCurrency(COUNTRY_CONFIG[normalizedCountry].defaultCurrency);
  };

  const handleSave = () => {
    writeCookie("afri_country", selectedCountry, 180);
    writeCookie("afri_currency", selectedCurrency, 180);
    writeCookie(DISMISS_COOKIE, "1", 180);

    startTransition(() => {
      setIsOpen(false);
      router.refresh();
    });
  };

  const handleDismiss = () => {
    writeCookie(DISMISS_COOKIE, "1", 30);
    setIsOpen(false);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-[#111827]/45 px-4 py-6 backdrop-blur-[2px]">
      <div className="w-full max-w-[560px] rounded-[28px] border border-[#f1d6c3] bg-[linear-gradient(180deg,#fff8f3_0%,#ffffff_100%)] p-6 shadow-[0_30px_80px_rgba(17,24,39,0.25)] sm:p-7">
        <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#ff6a00]">Personnalisation pays</div>
        <h2 className="mt-2 text-[28px] font-black tracking-[-0.05em] text-[#1f2937]">Choisissez votre pays</h2>
        <p className="mt-3 text-[14px] leading-6 text-[#667085]">Le pays permet d'adapter la devise, les pages et surtout le mode de livraison sourcing. Vous pourrez toujours le modifier plus tard dans la barre du haut.</p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-[13px] font-semibold text-[#344054]">
            Pays
            <select value={selectedCountry} onChange={(event) => handleCountryChange(event.target.value)} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] bg-white px-4 text-[14px] text-[#111827] outline-none focus:border-[#ff6a00]">
              {DELIVERY_COUNTRY_OPTIONS.map((option) => (
                <option key={option.code} value={option.code}>{option.flagEmoji} {option.label}</option>
              ))}
            </select>
          </label>

          <label className="text-[13px] font-semibold text-[#344054]">
            Devise
            <select value={selectedCurrency} onChange={(event) => setSelectedCurrency(event.target.value as CurrencyCode)} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] bg-white px-4 text-[14px] text-[#111827] outline-none focus:border-[#ff6a00]">
              {CURRENCY_OPTIONS.map((option) => (
                <option key={option.code} value={option.code}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 rounded-[18px] border border-[#d8e5fb] bg-[#eef6ff] px-4 py-4 text-[13px] leading-6 text-[#1d4f91]">
          {countryDescription}
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={handleDismiss} className="inline-flex h-11 items-center justify-center rounded-full border border-[#d7dce5] px-5 text-[14px] font-semibold text-[#344054] transition hover:border-[#ff6a00] hover:text-[#ff6a00]">
            Plus tard
          </button>
          <button type="button" onClick={handleSave} disabled={isPending} className="inline-flex h-11 items-center justify-center rounded-full bg-[#ff6a00] px-6 text-[14px] font-semibold text-white transition hover:bg-[#e55e00] disabled:cursor-not-allowed disabled:opacity-70">
            {isPending ? "Enregistrement..." : "Continuer"}
          </button>
        </div>
      </div>
    </div>
  );
}