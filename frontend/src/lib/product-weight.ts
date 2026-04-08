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
  packaging?: string;
  unit?: string;
  specs?: string[];
  lotCbm?: string;
  moq?: number;
};

type WeightProfile = {
  key: string;
  pattern: RegExp;
  weightGrams: number;
  dimensions: PackageDimensionsCm;
  densityKgPerCbm: number;
  minimumGrams?: number;
  bulky?: boolean;
};

type WeightModifier = {
  pattern: RegExp;
  multiplier: number;
};

const WEIGHT_PROFILES: readonly WeightProfile[] = [
  { key: "jewelry", pattern: /\b(jewelry|bijou|bijoux|ring|bracelet|necklace|earring|piercing|brooch|bead|charm|pendant)\b/i, weightGrams: 20, dimensions: { lengthCm: 8, widthCm: 6, heightCm: 2 }, densityKgPerCbm: 180, minimumGrams: 8 },
  { key: "watch", pattern: /\b(watch|montre|smartwatch|watch\s*strap)\b/i, weightGrams: 120, dimensions: { lengthCm: 10, widthCm: 8, heightCm: 6 }, densityKgPerCbm: 220, minimumGrams: 60 },
  { key: "cosmetic", pattern: /\b(cosmetic|makeup|lipstick|serum|cream|creme|lotion|shampoo|conditioner|skincare|perfume|parfum|spray|gel|mask|masque)\b/i, weightGrams: 180, dimensions: { lengthCm: 16, widthCm: 6, heightCm: 6 }, densityKgPerCbm: 320, minimumGrams: 60 },
  { key: "gloves", pattern: /\b(glove|gloves|gant|gants|mitt|mitaine)\b/i, weightGrams: 120, dimensions: { lengthCm: 22, widthCm: 15, heightCm: 4 }, densityKgPerCbm: 120, minimumGrams: 70 },
  { key: "soft-accessory", pattern: /\b(sock|socks|underwear|lingerie|cap|hat|beanie|scarf|belt)\b/i, weightGrams: 90, dimensions: { lengthCm: 18, widthCm: 14, heightCm: 4 }, densityKgPerCbm: 120, minimumGrams: 40 },
  { key: "shirt", pattern: /\b(shirt|t-shirt|tee|polo|jersey|top|blouse)\b/i, weightGrams: 220, dimensions: { lengthCm: 30, widthCm: 24, heightCm: 3 }, densityKgPerCbm: 120, minimumGrams: 130 },
  { key: "pants", pattern: /\b(trouser|trousers|pants|jean|jeans|short|shorts|legging)\b/i, weightGrams: 380, dimensions: { lengthCm: 32, widthCm: 25, heightCm: 5 }, densityKgPerCbm: 120, minimumGrams: 220 },
  { key: "hoodie", pattern: /\b(hoodie|sweatshirt|sweater|pull|pullover)\b/i, weightGrams: 650, dimensions: { lengthCm: 36, widthCm: 28, heightCm: 8 }, densityKgPerCbm: 130, minimumGrams: 400 },
  { key: "jacket", pattern: /\b(jacket|coat|parka|blazer|windbreaker)\b/i, weightGrams: 950, dimensions: { lengthCm: 40, widthCm: 32, heightCm: 10 }, densityKgPerCbm: 150, minimumGrams: 600 },
  { key: "dress", pattern: /\b(dress|robe|skirt|jupe)\b/i, weightGrams: 420, dimensions: { lengthCm: 34, widthCm: 26, heightCm: 5 }, densityKgPerCbm: 120, minimumGrams: 200 },
  { key: "shoe", pattern: /\b(shoe|shoes|sneaker|sneakers|boot|boots|sandals|slippers|chaussure|chaussures)\b/i, weightGrams: 950, dimensions: { lengthCm: 34, widthCm: 22, heightCm: 12 }, densityKgPerCbm: 160, minimumGrams: 450 },
  { key: "bag", pattern: /\b(backpack|bag|sac|wallet|purse|luggage|suitcase|handbag)\b/i, weightGrams: 800, dimensions: { lengthCm: 34, widthCm: 26, heightCm: 12 }, densityKgPerCbm: 110, minimumGrams: 300 },
  { key: "phone", pattern: /\b(phone|iphone|android|smartphone|mobile\s+phone)\b/i, weightGrams: 250, dimensions: { lengthCm: 18, widthCm: 10, heightCm: 5 }, densityKgPerCbm: 260, minimumGrams: 140 },
  { key: "tablet", pattern: /\b(tablet|ipad|galaxy\s+tab|e-reader|kindle)\b/i, weightGrams: 650, dimensions: { lengthCm: 28, widthCm: 20, heightCm: 6 }, densityKgPerCbm: 220, minimumGrams: 320 },
  { key: "laptop", pattern: /\b(laptop|notebook|macbook|ultrabook)\b/i, weightGrams: 2200, dimensions: { lengthCm: 40, widthCm: 30, heightCm: 8 }, densityKgPerCbm: 220, minimumGrams: 1200 },
  { key: "keyboard", pattern: /\b(keyboard|clavier)\b/i, weightGrams: 850, dimensions: { lengthCm: 46, widthCm: 16, heightCm: 5 }, densityKgPerCbm: 180, minimumGrams: 450 },
  { key: "mouse", pattern: /\b(mouse|souris)\b/i, weightGrams: 180, dimensions: { lengthCm: 14, widthCm: 9, heightCm: 5 }, densityKgPerCbm: 170, minimumGrams: 90 },
  { key: "headset", pattern: /\b(headset|gaming\s+headset|casque|headphone|headphones)\b/i, weightGrams: 450, dimensions: { lengthCm: 24, widthCm: 20, heightCm: 12 }, densityKgPerCbm: 110, minimumGrams: 220 },
  { key: "earbuds", pattern: /\b(earbuds|earbud|earphone|earphones|airpods)\b/i, weightGrams: 90, dimensions: { lengthCm: 10, widthCm: 8, heightCm: 4 }, densityKgPerCbm: 140, minimumGrams: 35 },
  { key: "camera", pattern: /\b(camera|webcam|camcorder|drone)\b/i, weightGrams: 480, dimensions: { lengthCm: 18, widthCm: 14, heightCm: 10 }, densityKgPerCbm: 180, minimumGrams: 150 },
  { key: "cable", pattern: /\b(cable|wire|cord|usb|hdmi|displayport)\b/i, weightGrams: 120, dimensions: { lengthCm: 18, widthCm: 12, heightCm: 4 }, densityKgPerCbm: 150, minimumGrams: 45 },
  { key: "charger", pattern: /\b(charger|adapter|adaptateur|dock|station|hub)\b/i, weightGrams: 280, dimensions: { lengthCm: 18, widthCm: 12, heightCm: 6 }, densityKgPerCbm: 220, minimumGrams: 120 },
  { key: "powerbank", pattern: /\b(power\s*bank|battery\s*pack|portable\s*battery)\b/i, weightGrams: 420, dimensions: { lengthCm: 16, widthCm: 10, heightCm: 5 }, densityKgPerCbm: 300, minimumGrams: 220 },
  { key: "router", pattern: /\b(router|modem|wifi|switch|network)\b/i, weightGrams: 520, dimensions: { lengthCm: 24, widthCm: 18, heightCm: 7 }, densityKgPerCbm: 180, minimumGrams: 220 },
  { key: "monitor", pattern: /\b(monitor|screen|display|gaming\s+monitor)\b/i, weightGrams: 6500, dimensions: { lengthCm: 78, widthCm: 48, heightCm: 18 }, densityKgPerCbm: 150, minimumGrams: 2800 },
  { key: "tv", pattern: /\b(tv|television|smart\s*tv)\b/i, weightGrams: 12000, dimensions: { lengthCm: 110, widthCm: 70, heightCm: 18 }, densityKgPerCbm: 140, minimumGrams: 5000 },
  { key: "printer", pattern: /\b(printer|scanner|copier)\b/i, weightGrams: 9000, dimensions: { lengthCm: 52, widthCm: 42, heightCm: 28 }, densityKgPerCbm: 170, minimumGrams: 4000 },
  { key: "led-strip", pattern: /\b(led\s*strip|strip\s*light|light\s*strip|neon\s*light)\b/i, weightGrams: 250, dimensions: { lengthCm: 18, widthCm: 18, heightCm: 6 }, densityKgPerCbm: 110, minimumGrams: 120 },
  { key: "lamp", pattern: /\b(lamp|lampe|light|lighting|lustre|chandelier)\b/i, weightGrams: 1400, dimensions: { lengthCm: 36, widthCm: 28, heightCm: 20 }, densityKgPerCbm: 110, minimumGrams: 350 },
  { key: "fan", pattern: /\b(fan|ventilator|ventilateur)\b/i, weightGrams: 3200, dimensions: { lengthCm: 45, widthCm: 25, heightCm: 45 }, densityKgPerCbm: 110, minimumGrams: 1200 },
  { key: "small-appliance", pattern: /\b(blender|mixer|kettle|toaster|coffee|machine|juicer|rice\s*cooker)\b/i, weightGrams: 2400, dimensions: { lengthCm: 34, widthCm: 24, heightCm: 28 }, densityKgPerCbm: 160, minimumGrams: 900 },
  { key: "vacuum", pattern: /\b(vacuum|aspirateur|cleaner|steam\s*mop)\b/i, weightGrams: 4500, dimensions: { lengthCm: 48, widthCm: 30, heightCm: 24 }, densityKgPerCbm: 140, minimumGrams: 2200 },
  { key: "gaming-chair", pattern: /\b(gaming\s+chair|office\s+chair|chair|chaise|fauteuil)\b/i, weightGrams: 15000, dimensions: { lengthCm: 78, widthCm: 32, heightCm: 60 }, densityKgPerCbm: 160, minimumGrams: 7000, bulky: true },
  { key: "desk", pattern: /\b(desk|bureau|table|tables)\b/i, weightGrams: 18000, dimensions: { lengthCm: 120, widthCm: 70, heightCm: 18 }, densityKgPerCbm: 180, minimumGrams: 8000, bulky: true },
  { key: "storage-furniture", pattern: /\b(cabinet|wardrobe|dresser|nightstand|bookshelf|shelf|armoire|commode)\b/i, weightGrams: 24000, dimensions: { lengthCm: 110, widthCm: 55, heightCm: 22 }, densityKgPerCbm: 180, minimumGrams: 10000, bulky: true },
  { key: "bed", pattern: /\b(bed|lit|mattress|sofa|canape|couch)\b/i, weightGrams: 30000, dimensions: { lengthCm: 150, widthCm: 60, heightCm: 40 }, densityKgPerCbm: 150, minimumGrams: 12000, bulky: true },
  { key: "stroller", pattern: /\b(stroller|poussette|car\s*seat|baby\s+walker)\b/i, weightGrams: 9000, dimensions: { lengthCm: 58, widthCm: 44, heightCm: 30 }, densityKgPerCbm: 130, minimumGrams: 3500 },
  { key: "toy", pattern: /\b(toy|jouet|lego|figure|figurine|plush|peluche|doll)\b/i, weightGrams: 250, dimensions: { lengthCm: 20, widthCm: 16, heightCm: 10 }, densityKgPerCbm: 90, minimumGrams: 60 },
  { key: "book", pattern: /\b(book|livre|notebook|journal|planner)\b/i, weightGrams: 420, dimensions: { lengthCm: 24, widthCm: 18, heightCm: 4 }, densityKgPerCbm: 240, minimumGrams: 120 },
  { key: "tool", pattern: /\b(tool|drill|screwdriver|wrench|plier|toolbox|kit)\b/i, weightGrams: 1800, dimensions: { lengthCm: 32, widthCm: 24, heightCm: 12 }, densityKgPerCbm: 220, minimumGrams: 400 },
  { key: "sports", pattern: /\b(ball|fitness|yoga|dumbbell|bicycle|helmet|scooter)\b/i, weightGrams: 2500, dimensions: { lengthCm: 38, widthCm: 28, heightCm: 20 }, densityKgPerCbm: 140, minimumGrams: 250 },
  { key: "pet", pattern: /\b(pet|dog|cat|aquarium|litter|cage)\b/i, weightGrams: 1200, dimensions: { lengthCm: 30, widthCm: 24, heightCm: 16 }, densityKgPerCbm: 130, minimumGrams: 200 },
  { key: "generic-small", pattern: /\b(accessory|accessoire|gadget|portable|mini\s+device)\b/i, weightGrams: 150, dimensions: { lengthCm: 16, widthCm: 12, heightCm: 5 }, densityKgPerCbm: 140, minimumGrams: 50 },
];

const WEIGHT_MODIFIERS: readonly WeightModifier[] = [
  { pattern: /\b(mini|nano|micro|slim|ultra\s*slim)\b/i, multiplier: 0.65 },
  { pattern: /\b(compact|portable|travel|foldable|lite|lightweight)\b/i, multiplier: 0.8 },
  { pattern: /\b(pro|plus|max|large|big|grand|xl|xxl|king|heavy\s*duty|industrial)\b/i, multiplier: 1.35 },
  { pattern: /\b(extra\s*large|oversized|giant|commercial)\b/i, multiplier: 1.6 },
  { pattern: /\b(set|kit|bundle|combo)\b/i, multiplier: 1.2 },
];

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
    context.packaging ?? "",
    context.unit ?? "",
    ...(context.categoryPath ?? []),
    ...(context.keywords ?? []),
    ...(context.specs ?? []),
  ]
    .join(" ")
    .toLowerCase();
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

function scaleDimensions(base: PackageDimensionsCm, scale: number) {
  return {
    lengthCm: roundDimension(base.lengthCm * scale),
    widthCm: roundDimension(base.widthCm * scale),
    heightCm: roundDimension(base.heightCm * scale),
  };
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

  return scaleDimensions(base, scale);
}

function getMatchedProfile(context?: ItemWeightContext) {
  const haystack = buildWeightHaystack(context);
  return WEIGHT_PROFILES.find((profile) => profile.pattern.test(haystack));
}

function extractInchScale(haystack: string, baseWeightGrams: number) {
  const match = haystack.match(/\b(\d{2,3})(?:\s|-)?(?:inch|inches|''|\"|pouces?)\b/i);
  if (!match) {
    return 1;
  }

  const inches = Number(match[1]);
  if (!Number.isFinite(inches) || inches <= 0) {
    return 1;
  }

  if (baseWeightGrams >= 10_000) {
    return Math.min(2.2, Math.max(0.7, inches / 55));
  }

  if (baseWeightGrams >= 4_000) {
    return Math.min(2.1, Math.max(0.65, inches / 32));
  }

  return 1;
}

function extractLiterScale(haystack: string) {
  const match = haystack.match(/\b(\d+(?:[.,]\d+)?)\s?(?:l|litre|liter|liters|litres)\b/i);
  if (!match) {
    return 1;
  }

  const liters = Number(match[1].replace(",", "."));
  if (!Number.isFinite(liters) || liters <= 0) {
    return 1;
  }

  return Math.min(3, Math.max(0.7, Math.sqrt(liters)));
}

function extractCountMultiplier(haystack: string) {
  const directMatch = haystack.match(/\b(\d+)\s?(?:pcs|pc|pieces|piece|pack|packs|pair|pairs|set)\b/i);
  if (!directMatch) {
    return 1;
  }

  const count = Number(directMatch[1]);
  if (!Number.isFinite(count) || count <= 1) {
    return 1;
  }

  return Math.min(4, Math.max(1, count * 0.35 + 0.65));
}

function resolveProfileScale(context?: ItemWeightContext, baseWeightGrams = 0) {
  const haystack = buildWeightHaystack(context);
  let scale = extractInchScale(haystack, baseWeightGrams) * extractLiterScale(haystack) * extractCountMultiplier(haystack);

  for (const modifier of WEIGHT_MODIFIERS) {
    if (modifier.pattern.test(haystack)) {
      scale *= modifier.multiplier;
    }
  }

  return Math.min(4, Math.max(0.45, scale));
}

function inferGenericFallbackWeightGrams(context?: ItemWeightContext) {
  const haystack = buildWeightHaystack(context);

  if (/\b(home|kitchen|office|appliance|device|electronic|electronics)\b/i.test(haystack)) {
    return 900;
  }

  if (/\b(fashion|clothing|wear|textile|fabric)\b/i.test(haystack)) {
    return 320;
  }

  return 250;
}

export function inferMinimumReasonableItemWeightGrams(context?: ItemWeightContext) {
  const profile = getMatchedProfile(context);
  if (profile) {
    const scaled = profile.minimumGrams ?? Math.round(profile.weightGrams * 0.55);
    return Math.max(8, Math.round(scaled * resolveProfileScale(context, profile.weightGrams)));
  }

  return inferGenericFallbackWeightGrams(context);
}

export function inferTypicalPackageDimensionsCm(context?: ItemWeightContext): PackageDimensionsCm {
  const profile = getMatchedProfile(context);
  const scale = resolveProfileScale(context, profile?.weightGrams ?? 0);
  const base = profile ? scaleDimensions(profile.dimensions, Math.cbrt(scale)) : scaleDimensions({ lengthCm: 24, widthCm: 16, heightCm: 8 }, Math.cbrt(scale));
  return scaleDimensionsToLotCbm(base, context);
}

export function estimateWeightFromLotCbm(context?: ItemWeightContext) {
  const perUnitCbm = parseLotCbmPerUnit(context?.lotCbm, context?.moq);
  if (typeof perUnitCbm !== "number") {
    return undefined;
  }

  const profile = getMatchedProfile(context);
  const densityKgPerCbm = profile?.densityKgPerCbm ?? 140;
  return sanitizeItemWeightGrams(Math.round(perUnitCbm * densityKgPerCbm * 1000));
}

export function resolveCoherentItemWeightGrams(value: number | undefined, context?: ItemWeightContext) {
  const sanitized = sanitizeItemWeightGrams(value);
  const minimumGrams = inferMinimumReasonableItemWeightGrams(context);
  const profile = getMatchedProfile(context);

  if (typeof sanitized === "number" && sanitized >= minimumGrams) {
    return sanitized;
  }

  const estimatedFromVolume = estimateWeightFromLotCbm(context);
  if (typeof estimatedFromVolume === "number" && estimatedFromVolume >= minimumGrams) {
    return estimatedFromVolume;
  }

  if (profile) {
    return sanitizeItemWeightGrams(Math.round(profile.weightGrams * resolveProfileScale(context, profile.weightGrams))) ?? minimumGrams;
  }

  return minimumGrams;
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
