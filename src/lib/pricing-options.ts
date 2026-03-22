export type CurrencyCode = "EUR" | "USD" | "GBP" | "CAD" | "MAD" | "XOF" | "GHS";
export type LanguageCode = "fr" | "en";

export type CountryCode =
  | "FR"
  | "BE"
  | "CH"
  | "CA"
  | "MA"
  | "GB"
  | "US"
  | "BJ"
  | "GH"
  | "CI"
  | "BF"
  | "TG";

export type CountryConfig = {
  countryLabel: string;
  defaultLanguage: LanguageCode;
  locale: string;
  defaultCurrency: CurrencyCode;
  shippingWindow: string;
  flagEmoji: string;
};

export const CURRENCY_CONFIG: Record<CurrencyCode, { code: CurrencyCode; label: string; rateFromUsd: number }> = {
  EUR: { code: "EUR", label: "Euro", rateFromUsd: 0.92 },
  USD: { code: "USD", label: "US Dollar", rateFromUsd: 1 },
  GBP: { code: "GBP", label: "Livre sterling", rateFromUsd: 0.78 },
  CAD: { code: "CAD", label: "Dollar canadien", rateFromUsd: 1.36 },
  MAD: { code: "MAD", label: "Dirham marocain", rateFromUsd: 9.92 },
  XOF: { code: "XOF", label: "Franc CFA", rateFromUsd: 602 },
  GHS: { code: "GHS", label: "Cedi ghanéen", rateFromUsd: 15.5 },
};

export const COUNTRY_CONFIG: Record<CountryCode, CountryConfig> = {
  FR: {
    countryLabel: "France",
    defaultLanguage: "fr",
    locale: "fr-FR",
    defaultCurrency: "EUR",
    shippingWindow: "4 à 8 jours",
    flagEmoji: "🇫🇷",
  },
  BE: {
    countryLabel: "Belgique",
    defaultLanguage: "fr",
    locale: "fr-BE",
    defaultCurrency: "EUR",
    shippingWindow: "4 à 8 jours",
    flagEmoji: "🇧🇪",
  },
  CH: {
    countryLabel: "Suisse",
    defaultLanguage: "fr",
    locale: "fr-CH",
    defaultCurrency: "EUR",
    shippingWindow: "5 à 9 jours",
    flagEmoji: "🇨🇭",
  },
  CA: {
    countryLabel: "Canada",
    defaultLanguage: "fr",
    locale: "fr-CA",
    defaultCurrency: "CAD",
    shippingWindow: "5 à 10 jours",
    flagEmoji: "🇨🇦",
  },
  MA: {
    countryLabel: "Maroc",
    defaultLanguage: "fr",
    locale: "fr-MA",
    defaultCurrency: "MAD",
    shippingWindow: "6 à 12 jours",
    flagEmoji: "🇲🇦",
  },
  GB: {
    countryLabel: "United Kingdom",
    defaultLanguage: "en",
    locale: "en-GB",
    defaultCurrency: "GBP",
    shippingWindow: "4 to 7 days",
    flagEmoji: "🇬🇧",
  },
  US: {
    countryLabel: "United States",
    defaultLanguage: "en",
    locale: "en-US",
    defaultCurrency: "USD",
    shippingWindow: "3 to 6 days",
    flagEmoji: "🇺🇸",
  },
  BJ: {
    countryLabel: "Bénin",
    defaultLanguage: "fr",
    locale: "fr-BJ",
    defaultCurrency: "XOF",
    shippingWindow: "7 à 13 jours",
    flagEmoji: "🇧🇯",
  },
  GH: {
    countryLabel: "Ghana",
    defaultLanguage: "en",
    locale: "en-GH",
    defaultCurrency: "GHS",
    shippingWindow: "6 to 11 days",
    flagEmoji: "🇬🇭",
  },
  CI: {
    countryLabel: "Côte d'Ivoire",
    defaultLanguage: "fr",
    locale: "fr-CI",
    defaultCurrency: "XOF",
    shippingWindow: "7 à 12 jours",
    flagEmoji: "🇨🇮",
  },
  BF: {
    countryLabel: "Burkina Faso",
    defaultLanguage: "fr",
    locale: "fr-BF",
    defaultCurrency: "XOF",
    shippingWindow: "7 à 13 jours",
    flagEmoji: "🇧🇫",
  },
  TG: {
    countryLabel: "Togo",
    defaultLanguage: "fr",
    locale: "fr-TG",
    defaultCurrency: "XOF",
    shippingWindow: "7 à 12 jours",
    flagEmoji: "🇹🇬",
  },
};

export const ACCEPT_LANGUAGE_TO_COUNTRY: Array<[string, CountryCode]> = [
  ["fr-fr", "FR"],
  ["fr-be", "BE"],
  ["fr-ch", "CH"],
  ["fr-ca", "CA"],
  ["fr-ma", "MA"],
  ["fr-bj", "BJ"],
  ["en-gh", "GH"],
  ["fr-ci", "CI"],
  ["fr-bf", "BF"],
  ["fr-tg", "TG"],
  ["en-gb", "GB"],
  ["en-us", "US"],
  ["fr", "FR"],
  ["en", "US"],
];

export const DELIVERY_COUNTRY_OPTIONS: Array<{ code: CountryCode; label: string; flagEmoji: string }> = [
  { code: "FR", label: "France", flagEmoji: "🇫🇷" },
  { code: "BJ", label: "Bénin", flagEmoji: "🇧🇯" },
  { code: "GH", label: "Ghana", flagEmoji: "🇬🇭" },
  { code: "CI", label: "Côte d'Ivoire", flagEmoji: "🇨🇮" },
  { code: "BF", label: "Burkina Faso", flagEmoji: "🇧🇫" },
  { code: "TG", label: "Togo", flagEmoji: "🇹🇬" },
];

export const CURRENCY_OPTIONS: Array<{ code: CurrencyCode; label: string }> = [
  { code: "EUR", label: "EUR" },
  { code: "XOF", label: "XOF" },
  { code: "GHS", label: "GHS" },
  { code: "USD", label: "USD" },
];

export const LANGUAGE_OPTIONS: Array<{ code: LanguageCode; label: string; locale: string }> = [
  { code: "fr", label: "Français", locale: "fr-FR" },
  { code: "en", label: "English", locale: "en-US" },
];