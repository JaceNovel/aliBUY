const MAX_REASONABLE_ITEM_WEIGHT_GRAMS = 500_000;

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
