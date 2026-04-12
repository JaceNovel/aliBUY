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

type GeoCoordinates = {
  latitude: number;
  longitude: number;
};

type GeocodedCountryResolutionInput = {
  countryCode?: string;
  countryLabel?: string;
  displayName?: string;
  city?: string;
  state?: string;
  addressLine1?: string;
  coordinates?: GeoCoordinates | null;
  fallbackCountryCode?: string;
};

type CountryBounds = {
  minLatitude: number;
  maxLatitude: number;
  minLongitude: number;
  maxLongitude: number;
};

const COUNTRY_COORDINATE_BOUNDS: Partial<Record<string, CountryBounds[]>> = {
  FR: [
    { minLatitude: 41, maxLatitude: 51.7, minLongitude: -5.6, maxLongitude: 9.9 },
    { minLatitude: 41.2, maxLatitude: 43.2, minLongitude: 8.4, maxLongitude: 9.7 },
  ],
  BE: [{ minLatitude: 49.4, maxLatitude: 51.6, minLongitude: 2.4, maxLongitude: 6.5 }],
  CH: [{ minLatitude: 45.7, maxLatitude: 47.9, minLongitude: 5.8, maxLongitude: 10.6 }],
  GB: [{ minLatitude: 49.8, maxLatitude: 59.5, minLongitude: -8.7, maxLongitude: 2.1 }],
  MA: [{ minLatitude: 20.7, maxLatitude: 35.9, minLongitude: -17.2, maxLongitude: -0.9 }],
  BJ: [{ minLatitude: 6.1, maxLatitude: 12.5, minLongitude: 0.7, maxLongitude: 3.9 }],
  GH: [{ minLatitude: 4.5, maxLatitude: 11.3, minLongitude: -3.4, maxLongitude: 1.4 }],
  CI: [{ minLatitude: 4.1, maxLatitude: 10.8, minLongitude: -8.7, maxLongitude: -2.4 }],
  BF: [{ minLatitude: 9.3, maxLatitude: 15.1, minLongitude: -5.6, maxLongitude: 2.5 }],
  TG: [{ minLatitude: 5.9, maxLatitude: 11.2, minLongitude: -0.2, maxLongitude: 1.9 }],
  SN: [{ minLatitude: 12.2, maxLatitude: 16.9, minLongitude: -17.8, maxLongitude: -11.3 }],
  ML: [{ minLatitude: 10.1, maxLatitude: 25.1, minLongitude: -12.3, maxLongitude: 4.5 }],
  NG: [{ minLatitude: 4.2, maxLatitude: 13.9, minLongitude: 2.6, maxLongitude: 14.7 }],
  NE: [{ minLatitude: 11.6, maxLatitude: 23.6, minLongitude: 0, maxLongitude: 16 }],
  US: [{ minLatitude: 24.3, maxLatitude: 49.5, minLongitude: -125.1, maxLongitude: -66.9 }],
  CA: [{ minLatitude: 41.7, maxLatitude: 83.2, minLongitude: -141.1, maxLongitude: -52.6 }],
  CN: [{ minLatitude: 18, maxLatitude: 53.7, minLongitude: 73.5, maxLongitude: 135.1 }],
};

function resolveCountryCodeFromCoordinates(coordinates?: GeoCoordinates | null) {
  if (!coordinates) {
    return undefined;
  }

  const latitude = Number(coordinates.latitude);
  const longitude = Number(coordinates.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return undefined;
  }

  for (const [countryCode, boundsList] of Object.entries(COUNTRY_COORDINATE_BOUNDS)) {
    if (!Array.isArray(boundsList)) {
      continue;
    }

    if (boundsList.some((bounds) => latitude >= bounds.minLatitude
      && latitude <= bounds.maxLatitude
      && longitude >= bounds.minLongitude
      && longitude <= bounds.maxLongitude)) {
      return countryCode;
    }
  }

  return undefined;
}

export function resolveGeocodedCountryCode(input: GeocodedCountryResolutionInput) {
  const fallback = canonicalizeCountryCode(input.fallbackCountryCode);
  const coordinateCountry = resolveCountryCodeFromCoordinates(input.coordinates);
  const textCandidates = [
    input.countryCode,
    input.countryLabel,
    input.displayName,
    input.city,
    input.state,
    input.addressLine1,
  ];

  for (const candidate of textCandidates) {
    const resolved = canonicalizeCountryCode(candidate, "");
    if (/^[A-Z]{2}$/.test(resolved)) {
      if (coordinateCountry && resolved !== coordinateCountry) {
        continue;
      }

      return resolved;
    }
  }

  return coordinateCountry ?? fallback;
}