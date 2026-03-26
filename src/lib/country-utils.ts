import { COUNTRY_CONFIG } from "@/lib/pricing-options";

const COUNTRY_CODE_ALIASES: Record<string, string> = {
  fr: "FR",
  france: "FR",
  francais: "FR",
  francaise: "FR",
  french: "FR",
  be: "BE",
  belgique: "BE",
  belge: "BE",
  belgium: "BE",
  ch: "CH",
  suisse: "CH",
  swiss: "CH",
  switzerland: "CH",
  ca: "CA",
  canada: "CA",
  canadian: "CA",
  ma: "MA",
  maroc: "MA",
  marocain: "MA",
  marocaine: "MA",
  morocco: "MA",
  gb: "GB",
  uk: "GB",
  "united kingdom": "GB",
  britain: "GB",
  british: "GB",
  england: "GB",
  us: "US",
  usa: "US",
  america: "US",
  "united states": "US",
  "united states of america": "US",
  bj: "BJ",
  benin: "BJ",
  beninois: "BJ",
  beninoise: "BJ",
  gh: "GH",
  ghana: "GH",
  ghaneen: "GH",
  ghaneenne: "GH",
  ghanean: "GH",
  ci: "CI",
  "cote d ivoire": "CI",
  "cote divoire": "CI",
  "ivory coast": "CI",
  ivoirien: "CI",
  ivoirienne: "CI",
  bf: "BF",
  "burkina faso": "BF",
  burkina: "BF",
  burkinabe: "BF",
  tg: "TG",
  togo: "TG",
  togolais: "TG",
  togolaise: "TG",
  togolese: "TG",
  "republique togolaise": "TG",
  "republic of togo": "TG",
  cn: "CN",
  china: "CN",
  chine: "CN",
  chinese: "CN",
  sn: "SN",
  senegal: "SN",
  senegalais: "SN",
  senegalaise: "SN",
  ml: "ML",
  mali: "ML",
  malien: "ML",
  malienne: "ML",
  ng: "NG",
  nigeria: "NG",
  nigerian: "NG",
  ne: "NE",
  niger: "NE",
};

function normalizeCountryLookupKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z]+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function canonicalizeCountryCode(value: string | undefined, fallbackCountryCode?: string) {
  const normalizedValue = value?.trim();
  if (!normalizedValue) {
    return fallbackCountryCode ?? "";
  }

  const compactValue = normalizedValue.toUpperCase();
  if (/^[A-Z]{2}$/.test(compactValue)) {
    return compactValue;
  }

  const alias = COUNTRY_CODE_ALIASES[normalizeCountryLookupKey(normalizedValue)];
  if (alias) {
    return alias;
  }

  return fallbackCountryCode ?? compactValue;
}

export function getCountryDisplayLabel(countryCode: string | undefined) {
  const canonicalCode = canonicalizeCountryCode(countryCode);
  return COUNTRY_CONFIG[canonicalCode as keyof typeof COUNTRY_CONFIG]?.countryLabel ?? canonicalCode;
}