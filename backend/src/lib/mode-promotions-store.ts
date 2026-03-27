import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type ModePromotionHeroCoupon = {
  value: string;
  limit: string;
  code: string;
};

export type ModePromotionHeroSlide = {
  id: string;
  deadlinePrefix: string;
  endsAt: string;
  headline: string;
  accentColor: string;
  spotlightProductSlug: string;
  coupons: ModePromotionHeroCoupon[];
};

export type ModePromotionCoupon = {
  label: string;
  value: string;
  detail: string;
};

export type ModePromotionConfig = {
  heroSlides: ModePromotionHeroSlide[];
  featureCoupons: ModePromotionCoupon[];
  rushCoupons: ModePromotionCoupon[];
  groupedOfferSlugs: string[];
  dailyDealSlugs: string[];
  premiumSelectionSlugs: string[];
  choiceDealSlugs: string[];
  trendPromoSlugs: string[];
  flashRushSlugs: string[];
  finalDropSlugs: string[];
  updatedAt: string;
};

const SITE_DIR = path.join(process.cwd(), "data", "site");
const MODE_PROMOTIONS_PATH = path.join(SITE_DIR, "mode-promotions.json");

const DEFAULT_MODE_PROMOTIONS: ModePromotionConfig = {
  heroSlides: [
    {
      id: "hero-1",
      deadlinePrefix: "Fin de la promo :",
      endsAt: "2026-12-31T22:59:00Z",
      headline: "Promos vérifiées",
      accentColor: "#ffffff",
      spotlightProductSlug: "",
      coupons: [
        { value: "-125€", limit: "dès 899€ d'achat", code: "SMB125" },
        { value: "-110€", limit: "dès 799€ d'achat", code: "SMB110" },
        { value: "-85€", limit: "dès 529€ d'achat", code: "FRAS85" }
      ],
    },
    {
      id: "hero-2",
      deadlinePrefix: "Mode sélectionnée jusqu'au :",
      endsAt: "2026-12-31T22:59:00Z",
      headline: "Sélection mode",
      accentColor: "#ff7bd3",
      spotlightProductSlug: "",
      coupons: [
        { value: "-30%", limit: "dès 99€ d'achat", code: "STYLE30" },
        { value: "-22%", limit: "dès 69€ d'achat", code: "LOOK22" },
        { value: "-15%", limit: "dès 39€ d'achat", code: "PINK15" }
      ],
    },
  ],
  featureCoupons: [
    { label: "Coupon mode", value: "-18€", detail: "dès 120€" },
    { label: "Deal express", value: "-12€", detail: "dès 79€" },
    { label: "Bundle look", value: "-8€", detail: "dès 49€" },
  ],
  rushCoupons: [
    { label: "Max coupon", value: "-25€", detail: "dès 159€" },
    { label: "Choix rapide", value: "-14€", detail: "dès 89€" },
    { label: "Dernière chance", value: "-9€", detail: "dès 49€" },
  ],
  groupedOfferSlugs: [],
  dailyDealSlugs: [],
  premiumSelectionSlugs: [],
  choiceDealSlugs: [],
  trendPromoSlugs: [],
  flashRushSlugs: [],
  finalDropSlugs: [],
  updatedAt: new Date("2026-03-25T00:00:00.000Z").toISOString(),
};

async function ensureSiteDir() {
  await mkdir(SITE_DIR, { recursive: true });
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  await ensureSiteDir();

  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    await writeJsonFile(filePath, fallback);
    return fallback;
  }
}

async function writeJsonFile<T>(filePath: string, value: T) {
  await ensureSiteDir();
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function toNonEmptyString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean);
}

function normalizeHeroCoupon(value: unknown, index: number): ModePromotionHeroCoupon {
  const record = typeof value === "object" && value !== null ? value as Record<string, unknown> : {};

  return {
    value: toNonEmptyString(record.value, `-${10 + index}€`),
    limit: toNonEmptyString(record.limit, "dès 50€ d'achat"),
    code: toNonEmptyString(record.code, `PROMO${index + 1}`),
  };
}

function normalizePromoCoupon(value: unknown, index: number): ModePromotionCoupon {
  const record = typeof value === "object" && value !== null ? value as Record<string, unknown> : {};

  return {
    label: toNonEmptyString(record.label, `Coupon ${index + 1}`),
    value: toNonEmptyString(record.value, `-${10 + index}€`),
    detail: toNonEmptyString(record.detail, "dès 50€"),
  };
}

function normalizeHeroSlide(value: unknown, index: number): ModePromotionHeroSlide {
  const record = typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
  const fallback = DEFAULT_MODE_PROMOTIONS.heroSlides[index] ?? DEFAULT_MODE_PROMOTIONS.heroSlides[0];

  return {
    id: toNonEmptyString(record.id, fallback.id),
    deadlinePrefix: toNonEmptyString(record.deadlinePrefix, fallback.deadlinePrefix),
    endsAt: toNonEmptyString(record.endsAt, fallback.endsAt),
    headline: toNonEmptyString(record.headline, fallback.headline),
    accentColor: toNonEmptyString(record.accentColor, fallback.accentColor),
    spotlightProductSlug: toNonEmptyString(record.spotlightProductSlug),
    coupons: Array.isArray(record.coupons) && record.coupons.length > 0
      ? record.coupons.map(normalizeHeroCoupon)
      : fallback.coupons,
  };
}

function normalizeCoupons(value: unknown, fallback: ModePromotionCoupon[]) {
  if (!Array.isArray(value) || value.length === 0) {
    return fallback;
  }

  return value.map(normalizePromoCoupon);
}

function normalizeConfig(value: unknown): ModePromotionConfig {
  const record = typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
  const heroSlidesInput = Array.isArray(record.heroSlides) && record.heroSlides.length > 0 ? record.heroSlides : DEFAULT_MODE_PROMOTIONS.heroSlides;

  return {
    heroSlides: heroSlidesInput.slice(0, 4).map(normalizeHeroSlide),
    featureCoupons: normalizeCoupons(record.featureCoupons, DEFAULT_MODE_PROMOTIONS.featureCoupons),
    rushCoupons: normalizeCoupons(record.rushCoupons, DEFAULT_MODE_PROMOTIONS.rushCoupons),
    groupedOfferSlugs: toStringArray(record.groupedOfferSlugs),
    dailyDealSlugs: toStringArray(record.dailyDealSlugs),
    premiumSelectionSlugs: toStringArray(record.premiumSelectionSlugs),
    choiceDealSlugs: toStringArray(record.choiceDealSlugs),
    trendPromoSlugs: toStringArray(record.trendPromoSlugs),
    flashRushSlugs: toStringArray(record.flashRushSlugs),
    finalDropSlugs: toStringArray(record.finalDropSlugs),
    updatedAt: toNonEmptyString(record.updatedAt, new Date().toISOString()),
  };
}

export async function getModePromotionConfig() {
  const raw = await readJsonFile<ModePromotionConfig>(MODE_PROMOTIONS_PATH, DEFAULT_MODE_PROMOTIONS);
  return normalizeConfig(raw);
}

export async function saveModePromotionConfig(input: ModePromotionConfig) {
  const normalized = normalizeConfig({
    ...input,
    updatedAt: new Date().toISOString(),
  });

  await writeJsonFile(MODE_PROMOTIONS_PATH, normalized);
  return normalized;
}