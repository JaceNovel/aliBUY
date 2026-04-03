const MAX_REASONABLE_ITEM_WEIGHT_GRAMS = 500_000;

export type PackageDimensionsCm = {
  lengthCm: number;
  widthCm: number;
  heightCm: number;
};

export type ItemWeightContext = {
  title?: string;
  shortTitle?: string;
  query?: string;
  keywords?: string[];
  categorySlug?: string;
  categoryTitle?: string;
  categoryPath?: string[];
  lotCbm?: string;
  moq?: number;
};

const BULKY_ITEM_PATTERN = /\b(furniture|meuble|meubles|desk|bureau|table|tables|chair|chaise|fauteuil|sofa|canape|cabinet|wardrobe|dresser|nightstand|bookshelf|shelf|armoire|bed|lit|mattress|canape|bean\s+bag)\b/i;
const HOME_GOODS_PATTERN = /\b(lamp|lampe|lighting|light|kitchen|cookware|tool|storage|organizer|mirror|deco|decor|appliance|fan|printer|monitor|screen|display)\b/i;
const SOFT_GOODS_PATTERN = /\b(backpack|bag|sac|wallet|purse|shoe|shoes|chaussure|chaussures|hoodie|shirt|t-shirt|dress|robe|jacket|coat|trouser|pants)\b/i;
const SMALL_ACCESSORY_PATTERN = /\b(jewelry|bijou|bijoux|ring|bracelet|necklace|earring|piercing|brooch|bead|charm|pendant|watch\s+strap)\b/i;
const LIGHT_ELECTRONICS_PATTERN = /\b(phone|iphone|android|smartphone|mobile|tablet|ipad|charger|cable|earbuds|earphone|headphone|mouse|keyboard|power\s*bank|usb)\b/i;

function buildWeightHaystack(context?: ItemWeightContext) {
  if (!context) {
    return "";
  }

  return [
    context.title ?? "",
    context.shortTitle ?? "",
    context.query ?? "",
    context.categorySlug ?? "",
    context.categoryTitle ?? "",
    ...(context.categoryPath ?? []),
    ...(context.keywords ?? []),
  ]
    .join(" ")
    .toLowerCase();
}

function isBulkyItem(context?: ItemWeightContext) {
  return BULKY_ITEM_PATTERN.test(buildWeightHaystack(context));
}

function parseLotCbmPerUnit(lotCbm?: string, moq?: number) {
  if (!lotCbm) {
    return undefined;
  }

  const normalized = lotCbm.replace(/,/g, ".");
  const match = normalized.match(/\d+(?:\.\d+)?/);
  if (!match) {
    return undefined;
  }

  const totalLotCbm = Number(match[0]);
  if (!Number.isFinite(totalLotCbm) || totalLotCbm <= 0) {
    return undefined;
  }

  return totalLotCbm / Math.max(1, moq ?? 1);
}

function roundDimension(value: number) {
  return Number(Math.max(1, value).toFixed(1));
}

function scaleDimensionsToLotCbm(base: PackageDimensionsCm, context?: ItemWeightContext) {
  const perUnitCbm = parseLotCbmPerUnit(context?.lotCbm, context?.moq);
  if (typeof perUnitCbm !== "number") {
    return base;
  }

  const targetVolumeCm3 = perUnitCbm * 1_000_000;
  const currentVolumeCm3 = base.lengthCm * base.widthCm * base.heightCm;
  if (!Number.isFinite(targetVolumeCm3) || targetVolumeCm3 <= 0 || !Number.isFinite(currentVolumeCm3) || currentVolumeCm3 <= 0) {
    return base;
  }

  const scale = Math.cbrt(targetVolumeCm3 / currentVolumeCm3);
  if (!Number.isFinite(scale) || scale <= 0) {
    return base;
  }

  return {
    lengthCm: roundDimension(base.lengthCm * scale),
    widthCm: roundDimension(base.widthCm * scale),
    heightCm: roundDimension(base.heightCm * scale),
  };
}

export function inferMinimumReasonableItemWeightGrams(context?: ItemWeightContext) {
  const haystack = buildWeightHaystack(context);

  if (isBulkyItem(context)) {
    return 1_000;
  }

  if (HOME_GOODS_PATTERN.test(haystack)) {
    return 120;
  }

  if (SOFT_GOODS_PATTERN.test(haystack)) {
    return 80;
  }

  if (LIGHT_ELECTRONICS_PATTERN.test(haystack)) {
    return 15;
  }

  if (SMALL_ACCESSORY_PATTERN.test(haystack)) {
    return 3;
  }

  return 15;
}

export function inferTypicalPackageDimensionsCm(context?: ItemWeightContext): PackageDimensionsCm {
  const haystack = buildWeightHaystack(context);

  if (isBulkyItem(context)) {
    return scaleDimensionsToLotCbm({ lengthCm: 60, widthCm: 40, heightCm: 20 }, context);
  }

  if (/\bkeyboard|clavier\b/i.test(haystack)) {
    return scaleDimensionsToLotCbm({ lengthCm: 46, widthCm: 16, heightCm: 5 }, context);
  }

  if (/\bmouse|souris\b/i.test(haystack)) {
    return scaleDimensionsToLotCbm({ lengthCm: 14, widthCm: 9, heightCm: 5 }, context);
  }

  if (/\b(phone|iphone|android|smartphone|mobile|tablet|ipad)\b/i.test(haystack)) {
    return scaleDimensionsToLotCbm({ lengthCm: 18, widthCm: 12, heightCm: 5 }, context);
  }

  if (/\b(cable|charger|adapter|adaptateur|usb|hub|dock|station)\b/i.test(haystack)) {
    return scaleDimensionsToLotCbm({ lengthCm: 18, widthCm: 12, heightCm: 6 }, context);
  }

  if (HOME_GOODS_PATTERN.test(haystack)) {
    return scaleDimensionsToLotCbm({ lengthCm: 32, widthCm: 24, heightCm: 18 }, context);
  }

  if (SOFT_GOODS_PATTERN.test(haystack)) {
    return scaleDimensionsToLotCbm({ lengthCm: 35, widthCm: 28, heightCm: 6 }, context);
  }

  if (SMALL_ACCESSORY_PATTERN.test(haystack)) {
    return scaleDimensionsToLotCbm({ lengthCm: 10, widthCm: 8, heightCm: 3 }, context);
  }

  return scaleDimensionsToLotCbm({ lengthCm: 24, widthCm: 16, heightCm: 8 }, context);
}

export function estimateWeightFromLotCbm(context?: ItemWeightContext) {
  const perUnitCbm = parseLotCbmPerUnit(context?.lotCbm, context?.moq);
  if (typeof perUnitCbm !== "number") {
    return undefined;
  }

  const densityKgPerCbm = isBulkyItem(context) ? 160 : 110;
  return sanitizeItemWeightGrams(Math.round(perUnitCbm * densityKgPerCbm * 1000));
}

export function resolveCoherentItemWeightGrams(value: number | undefined, context?: ItemWeightContext) {
  const sanitized = sanitizeItemWeightGrams(value);
  const minimumGrams = inferMinimumReasonableItemWeightGrams(context);

  if (typeof sanitized === "number" && sanitized >= minimumGrams) {
    return sanitized;
  }

  const estimatedFromVolume = estimateWeightFromLotCbm(context);
  if (typeof estimatedFromVolume === "number" && estimatedFromVolume >= minimumGrams) {
    return estimatedFromVolume;
  }

  if (isBulkyItem(context)) {
    return minimumGrams;
  }

  return undefined;
}

export function resolveCoherentPackageDimensionsCm(
  value: PackageDimensionsCm | undefined,
  context?: ItemWeightContext,
) {
  if (
    value
    && Number.isFinite(value.lengthCm)
    && Number.isFinite(value.widthCm)
    && Number.isFinite(value.heightCm)
    && value.lengthCm > 0
    && value.widthCm > 0
    && value.heightCm > 0
  ) {
    return {
      lengthCm: roundDimension(value.lengthCm),
      widthCm: roundDimension(value.widthCm),
      heightCm: roundDimension(value.heightCm),
    };
  }

  return inferTypicalPackageDimensionsCm(context);
}

export function sanitizeItemWeightGrams(value: number | undefined) {
  if (!Number.isFinite(value) || typeof value !== "number") {
    return undefined;
  }

  const normalized = Math.round(value);
  if (normalized <= 0) {
    return undefined;
  }

  return normalized <= MAX_REASONABLE_ITEM_WEIGHT_GRAMS ? normalized : undefined;
}
