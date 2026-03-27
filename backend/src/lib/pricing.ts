import "server-only";

import { cache } from "react";
import { cookies, headers } from "next/headers";

import {
  ACCEPT_LANGUAGE_TO_COUNTRY,
  COUNTRY_CONFIG,
  CURRENCY_CONFIG,
  LANGUAGE_OPTIONS,
  type CountryCode,
  type CurrencyCode,
  type LanguageCode,
} from "@/lib/pricing-options";

function normalizeCountry(candidate?: string | null) {
  return candidate?.trim().toUpperCase() as CountryCode | undefined;
}

function normalizeCurrency(candidate?: string | null) {
  return candidate?.trim().toUpperCase() as CurrencyCode | undefined;
}

function normalizeLanguage(candidate?: string | null) {
  return candidate?.trim().toLowerCase() as LanguageCode | undefined;
}

function detectCountryFromLanguage(acceptLanguage?: string | null) {
  const normalized = acceptLanguage?.toLowerCase() ?? "";

  for (const [fragment, country] of ACCEPT_LANGUAGE_TO_COUNTRY) {
    if (normalized.includes(fragment)) {
      return country;
    }
  }

  return "FR";
}

function lookupCountryConfig(countryCode: CountryCode) {
  return COUNTRY_CONFIG[countryCode] ?? COUNTRY_CONFIG.FR;
}

function lookupCurrency(currencyCode?: CurrencyCode) {
  if (!currencyCode) {
    return undefined;
  }

  return CURRENCY_CONFIG[currencyCode];
}

function lookupLanguage(languageCode?: LanguageCode) {
  if (!languageCode) {
    return undefined;
  }

  return LANGUAGE_OPTIONS.find((option) => option.code === languageCode);
}

function formatPriceForCountry(
  amountUsd: number,
  locale: string,
  currency: CurrencyCode,
  rateFromUsd: number,
) {
  const localizedAmount = amountUsd * rateFromUsd;

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: localizedAmount >= 100 ? 0 : 2,
    maximumFractionDigits: localizedAmount >= 100 ? 0 : 2,
  }).format(localizedAmount);
}

export const getPricingContext = cache(async function getPricingContext(
  explicitCountryCode?: string,
  explicitCurrencyCode?: string,
  explicitLanguageCode?: string,
) {
  const [headerList, cookieStore] = await Promise.all([headers(), cookies()]);

  const detectedCountry =
    normalizeCountry(explicitCountryCode) ??
    normalizeCountry(cookieStore.get("afri_country")?.value) ??
    normalizeCountry(headerList.get("x-vercel-ip-country")) ??
    normalizeCountry(headerList.get("cf-ipcountry")) ??
    normalizeCountry(headerList.get("cloudfront-viewer-country")) ??
    normalizeCountry(headerList.get("x-country-code")) ??
    detectCountryFromLanguage(headerList.get("accept-language"));

  const config = lookupCountryConfig(detectedCountry);
  const selectedCurrency =
    lookupCurrency(normalizeCurrency(explicitCurrencyCode)) ??
    lookupCurrency(normalizeCurrency(cookieStore.get("afri_currency")?.value)) ??
    CURRENCY_CONFIG[config.defaultCurrency];
  const selectedLanguage =
    lookupLanguage(normalizeLanguage(explicitLanguageCode)) ??
    lookupLanguage(normalizeLanguage(cookieStore.get("afri_language")?.value)) ??
    lookupLanguage(config.defaultLanguage) ??
    LANGUAGE_OPTIONS[0];
  const languageLabel = `${selectedLanguage.label}-${selectedCurrency.code}`;

  return {
    countryCode: detectedCountry,
    countryLabel: config.countryLabel,
    languageCode: selectedLanguage.code,
    languageLabel,
    locale: selectedLanguage.locale,
    currency: {
      code: selectedCurrency.code,
      label: selectedCurrency.label,
      rateFromUsd: selectedCurrency.rateFromUsd,
    },
    shippingWindow: config.shippingWindow,
    flagEmoji: config.flagEmoji,
    exchangeLabel: `1 USD = ${new Intl.NumberFormat(selectedLanguage.locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(selectedCurrency.rateFromUsd)} ${selectedCurrency.code}`,
    formatPrice(amountUsd: number) {
      return formatPriceForCountry(amountUsd, selectedLanguage.locale, selectedCurrency.code, selectedCurrency.rateFromUsd);
    },
  };
});