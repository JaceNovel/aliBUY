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
  | "TG"
  | "AE"
  | "AT"
  | "AU"
  | "BR"
  | "DE"
  | "DK"
  | "EE"
  | "ES"
  | "HU"
  | "IE"
  | "IL"
  | "IS"
  | "IT"
  | "JP"
  | "LT"
  | "LU"
  | "LV"
  | "MX"
  | "NL"
  | "NO"
  | "NZ"
  | "PT"
  | "SE";

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
  AE: {
    countryLabel: "United Arab Emirates",
    defaultLanguage: "en",
    locale: "en-AE",
    defaultCurrency: "USD",
    shippingWindow: "5 to 10 days",
    flagEmoji: "🇦🇪",
  },
  AT: {
    countryLabel: "Austria",
    defaultLanguage: "en",
    locale: "en-AT",
    defaultCurrency: "EUR",
    shippingWindow: "4 to 8 days",
    flagEmoji: "🇦🇹",
  },
  AU: {
    countryLabel: "Australia",
    defaultLanguage: "en",
    locale: "en-AU",
    defaultCurrency: "USD",
    shippingWindow: "5 to 11 days",
    flagEmoji: "🇦🇺",
  },
  BR: {
    countryLabel: "Brazil",
    defaultLanguage: "en",
    locale: "en-BR",
    defaultCurrency: "USD",
    shippingWindow: "7 to 16 days",
    flagEmoji: "🇧🇷",
  },
  DE: {
    countryLabel: "Germany",
    defaultLanguage: "en",
    locale: "en-DE",
    defaultCurrency: "EUR",
    shippingWindow: "4 to 8 days",
    flagEmoji: "🇩🇪",
  },
  DK: {
    countryLabel: "Denmark",
    defaultLanguage: "en",
    locale: "en-DK",
    defaultCurrency: "USD",
    shippingWindow: "4 to 8 days",
    flagEmoji: "🇩🇰",
  },
  EE: {
    countryLabel: "Estonia",
    defaultLanguage: "en",
    locale: "en-EE",
    defaultCurrency: "EUR",
    shippingWindow: "4 to 8 days",
    flagEmoji: "🇪🇪",
  },
  ES: {
    countryLabel: "Spain",
    defaultLanguage: "en",
    locale: "en-ES",
    defaultCurrency: "EUR",
    shippingWindow: "4 to 8 days",
    flagEmoji: "🇪🇸",
  },
  HU: {
    countryLabel: "Hungary",
    defaultLanguage: "en",
    locale: "en-HU",
    defaultCurrency: "EUR",
    shippingWindow: "5 to 9 days",
    flagEmoji: "🇭🇺",
  },
  IE: {
    countryLabel: "Ireland",
    defaultLanguage: "en",
    locale: "en-IE",
    defaultCurrency: "EUR",
    shippingWindow: "4 to 8 days",
    flagEmoji: "🇮🇪",
  },
  IL: {
    countryLabel: "Israel",
    defaultLanguage: "en",
    locale: "en-IL",
    defaultCurrency: "USD",
    shippingWindow: "5 to 10 days",
    flagEmoji: "🇮🇱",
  },
  IS: {
    countryLabel: "Iceland",
    defaultLanguage: "en",
    locale: "en-IS",
    defaultCurrency: "USD",
    shippingWindow: "6 to 12 days",
    flagEmoji: "🇮🇸",
  },
  IT: {
    countryLabel: "Italy",
    defaultLanguage: "en",
    locale: "en-IT",
    defaultCurrency: "EUR",
    shippingWindow: "4 to 8 days",
    flagEmoji: "🇮🇹",
  },
  JP: {
    countryLabel: "Japan",
    defaultLanguage: "en",
    locale: "en-JP",
    defaultCurrency: "USD",
    shippingWindow: "4 to 9 days",
    flagEmoji: "🇯🇵",
  },
  LT: {
    countryLabel: "Lithuania",
    defaultLanguage: "en",
    locale: "en-LT",
    defaultCurrency: "EUR",
    shippingWindow: "4 to 8 days",
    flagEmoji: "🇱🇹",
  },
  LU: {
    countryLabel: "Luxembourg",
    defaultLanguage: "en",
    locale: "en-LU",
    defaultCurrency: "EUR",
    shippingWindow: "4 to 8 days",
    flagEmoji: "🇱🇺",
  },
  LV: {
    countryLabel: "Latvia",
    defaultLanguage: "en",
    locale: "en-LV",
    defaultCurrency: "EUR",
    shippingWindow: "4 to 8 days",
    flagEmoji: "🇱🇻",
  },
  MX: {
    countryLabel: "Mexico",
    defaultLanguage: "en",
    locale: "en-MX",
    defaultCurrency: "USD",
    shippingWindow: "5 to 11 days",
    flagEmoji: "🇲🇽",
  },
  NL: {
    countryLabel: "Netherlands",
    defaultLanguage: "en",
    locale: "en-NL",
    defaultCurrency: "EUR",
    shippingWindow: "4 to 8 days",
    flagEmoji: "🇳🇱",
  },
  NO: {
    countryLabel: "Norway",
    defaultLanguage: "en",
    locale: "en-NO",
    defaultCurrency: "USD",
    shippingWindow: "5 to 9 days",
    flagEmoji: "🇳🇴",
  },
  NZ: {
    countryLabel: "New Zealand",
    defaultLanguage: "en",
    locale: "en-NZ",
    defaultCurrency: "USD",
    shippingWindow: "5 to 11 days",
    flagEmoji: "🇳🇿",
  },
  PT: {
    countryLabel: "Portugal",
    defaultLanguage: "en",
    locale: "en-PT",
    defaultCurrency: "EUR",
    shippingWindow: "4 to 8 days",
    flagEmoji: "🇵🇹",
  },
  SE: {
    countryLabel: "Sweden",
    defaultLanguage: "en",
    locale: "en-SE",
    defaultCurrency: "USD",
    shippingWindow: "5 to 9 days",
    flagEmoji: "🇸🇪",
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
  { code: "BE", label: "Belgique", flagEmoji: "🇧🇪" },
  { code: "CH", label: "Suisse", flagEmoji: "🇨🇭" },
  { code: "CA", label: "Canada", flagEmoji: "🇨🇦" },
  { code: "GB", label: "United Kingdom", flagEmoji: "🇬🇧" },
  { code: "US", label: "United States", flagEmoji: "🇺🇸" },
  { code: "AE", label: "United Arab Emirates", flagEmoji: "🇦🇪" },
  { code: "AT", label: "Austria", flagEmoji: "🇦🇹" },
  { code: "AU", label: "Australia", flagEmoji: "🇦🇺" },
  { code: "BJ", label: "Bénin", flagEmoji: "🇧🇯" },
  { code: "BR", label: "Brazil", flagEmoji: "🇧🇷" },
  { code: "DE", label: "Germany", flagEmoji: "🇩🇪" },
  { code: "DK", label: "Denmark", flagEmoji: "🇩🇰" },
  { code: "EE", label: "Estonia", flagEmoji: "🇪🇪" },
  { code: "ES", label: "Spain", flagEmoji: "🇪🇸" },
  { code: "GH", label: "Ghana", flagEmoji: "🇬🇭" },
  { code: "HU", label: "Hungary", flagEmoji: "🇭🇺" },
  { code: "IE", label: "Ireland", flagEmoji: "🇮🇪" },
  { code: "IL", label: "Israel", flagEmoji: "🇮🇱" },
  { code: "IS", label: "Iceland", flagEmoji: "🇮🇸" },
  { code: "IT", label: "Italy", flagEmoji: "🇮🇹" },
  { code: "JP", label: "Japan", flagEmoji: "🇯🇵" },
  { code: "CI", label: "Côte d'Ivoire", flagEmoji: "🇨🇮" },
  { code: "BF", label: "Burkina Faso", flagEmoji: "🇧🇫" },
  { code: "LT", label: "Lithuania", flagEmoji: "🇱🇹" },
  { code: "LU", label: "Luxembourg", flagEmoji: "🇱🇺" },
  { code: "LV", label: "Latvia", flagEmoji: "🇱🇻" },
  { code: "MA", label: "Maroc", flagEmoji: "🇲🇦" },
  { code: "MX", label: "Mexico", flagEmoji: "🇲🇽" },
  { code: "NL", label: "Netherlands", flagEmoji: "🇳🇱" },
  { code: "NO", label: "Norway", flagEmoji: "🇳🇴" },
  { code: "NZ", label: "New Zealand", flagEmoji: "🇳🇿" },
  { code: "PT", label: "Portugal", flagEmoji: "🇵🇹" },
  { code: "SE", label: "Sweden", flagEmoji: "🇸🇪" },
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
