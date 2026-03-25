import { CURRENCY_CONFIG } from "@/lib/pricing-options";

type FreeDealPricingLike = {
  compareAtMultiplier: number;
  compareAtExtraEur: number;
};

const USD_PER_EUR = 1 / CURRENCY_CONFIG.EUR.rateFromUsd;

export function convertEurToUsd(amountEur: number) {
  return Number((amountEur * USD_PER_EUR).toFixed(2));
}

export function convertEurToFcfa(amountEur: number) {
  return Math.round(convertEurToUsd(amountEur) * CURRENCY_CONFIG.XOF.rateFromUsd);
}

export function formatFreeDealEuro(amountEur: number, locale = "fr-FR") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: amountEur >= 100 ? 0 : 2,
    maximumFractionDigits: amountEur >= 100 ? 0 : 2,
  }).format(amountEur);
}

export function calculateFreeDealCompareAtUsd(minUsd: number, config: FreeDealPricingLike) {
  const multiplied = minUsd * Math.max(config.compareAtMultiplier, 1);
  const boosted = minUsd + Math.max(convertEurToUsd(config.compareAtExtraEur), 0.25);
  return Number(Math.max(multiplied, boosted).toFixed(2));
}
