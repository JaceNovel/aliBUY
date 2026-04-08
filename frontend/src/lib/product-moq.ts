type MappableTier = {
  minimumQuantity?: number;
  quantityLabel?: string;
};

type MappableVariantPrice = {
  minimumQuantity?: number;
  quantityLabel?: string;
};

export type AlibabaMoqInfo = {
  value?: number;
  verified: boolean;
};

const MOQ_KEY_PATTERN = /(moq|min(?:imum)?[_ -]?order|begin_amount|quantity_min|min[_ -]?qty|min[_ -]?quantity|start[_ -]?quantity|order[_ -]?qty|order[_ -]?quantity|minimum[_ -]?quantity|order[_ -]?minimum|lowest[_ -]?order|least[_ -]?order|initial[_ -]?quantity)/i;

function normalizeMoqValue(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return undefined;
  }

  const rounded = Math.round(value);
  return rounded > 1000000 ? undefined : Math.max(1, rounded);
}

function parseMoqNumber(value: unknown) {
  if (typeof value === "number") {
    return normalizeMoqValue(value);
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const match = value.match(/\d+(?:[.,]\d+)?/);
  if (!match) {
    return undefined;
  }

  return normalizeMoqValue(Number(match[0].replace(',', '.')));
}

function hasMoqKey(keyHint?: string) {
  return Boolean(keyHint && MOQ_KEY_PATTERN.test(keyHint));
}

function extractMoqFromRecord(record: Record<string, unknown>) {
  const directKeys = [
    "moq",
    "min_order_quantity",
    "minOrderQuantity",
    "minimum_order_quantity",
    "minimumOrderQuantity",
    "quantity_min",
    "quantityMin",
    "min_qty",
    "minQty",
    "min_quantity",
    "minQuantity",
    "start_quantity",
    "startQuantity",
    "order_quantity",
    "orderQuantity",
    "order_minimum",
    "orderMinimum",
    "begin_amount",
    "beginAmount",
    "initial_quantity",
    "initialQuantity",
  ] as const;

  for (const key of directKeys) {
    const parsed = parseMoqNumber(record[key]);
    if (parsed) {
      return parsed;
    }
  }

  const hasPriceContext = [
    record.price,
    record.sku_price,
    record.sale_price,
    record.unit_price,
  ].some((entry) => typeof entry !== "undefined");

  if (hasPriceContext) {
    for (const key of ["quantity", "qty", "from"] as const) {
      const parsed = parseMoqNumber(record[key]);
      if (parsed) {
        return parsed;
      }
    }
  }

  const labelHint = [record.label, record.name, record.title, record.key, record.field_name]
    .filter((entry): entry is string => typeof entry === "string")
    .find((entry) => MOQ_KEY_PATTERN.test(entry));

  if (labelHint) {
    for (const candidate of [record.value, record.content, record.text, record.desc, record.description]) {
      const parsed = parseMoqNumber(candidate);
      if (parsed) {
        return parsed;
      }
    }
  }

  return undefined;
}

export function extractAlibabaMoqInfo(value: unknown, depth = 0, keyHint?: string): AlibabaMoqInfo {
  if (depth > 6 || value == null) {
    return { verified: false };
  }

  if (typeof value === "number") {
    const parsed = parseMoqNumber(value);
    return hasMoqKey(keyHint) && parsed ? { value: parsed, verified: true } : { verified: false };
  }

  if (typeof value === "string") {
    const parsed = parseMoqNumber(value);

    if (hasMoqKey(keyHint) && parsed) {
      return { value: parsed, verified: true };
    }

    if (MOQ_KEY_PATTERN.test(value) && parsed) {
      return { value: parsed, verified: true };
    }

    return { verified: false };
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const nested = extractAlibabaMoqInfo(entry, depth + 1, keyHint);
      if (nested.verified && nested.value) {
        return nested;
      }
    }

    return { verified: false };
  }

  if (typeof value !== "object") {
    return { verified: false };
  }

  const record = value as Record<string, unknown>;
  const direct = extractMoqFromRecord(record);
  if (direct) {
    return { value: direct, verified: true };
  }

  for (const [nestedKey, nestedValue] of Object.entries(record)) {
    const nested = extractAlibabaMoqInfo(nestedValue, depth + 1, nestedKey);
    if (nested.verified && nested.value) {
      return nested;
    }
  }

  return { verified: false };
}

function parseMinimumFromQuantityLabel(quantityLabel?: string) {
  if (!quantityLabel) {
    return undefined;
  }

  const normalized = quantityLabel.replace(/\s+/g, " ").trim();
  const rangeMatch = normalized.match(/(\d{1,7})\s*[-~]/);
  if (rangeMatch) {
    return normalizeMoqValue(Number(rangeMatch[1]));
  }

  const plusMatch = normalized.match(/(?:>=?\s*|from\s+)?(\d{1,7})\s*\+/i);
  if (plusMatch) {
    return normalizeMoqValue(Number(plusMatch[1]));
  }

  const firstNumber = normalized.match(/\d{1,7}/);
  return firstNumber ? normalizeMoqValue(Number(firstNumber[0])) : undefined;
}

function deriveMoqFromTiers(tiers: MappableTier[] = []) {
  const candidates = tiers.flatMap((tier) => {
    const fromMinimum = normalizeMoqValue(tier.minimumQuantity ?? Number.NaN);
    const fromLabel = parseMinimumFromQuantityLabel(tier.quantityLabel);
    return [fromMinimum, fromLabel].filter((entry): entry is number => typeof entry === "number");
  });

  if (candidates.length === 0) {
    return undefined;
  }

  return Math.min(...candidates);
}

export function resolveAlibabaMoq(input: {
  rawValue?: unknown;
  tiers?: MappableTier[];
  variantPricing?: MappableVariantPrice[];
  fallback?: number;
}): AlibabaMoqInfo {
  if (input.rawValue && typeof input.rawValue === "object" && !Array.isArray(input.rawValue)) {
    const record = input.rawValue as Record<string, unknown>;
    const tradeInfo = record.trade_info && typeof record.trade_info === "object" && !Array.isArray(record.trade_info)
      ? record.trade_info as Record<string, unknown>
      : null;
    const directTradeMoq = tradeInfo ? extractMoqFromRecord(tradeInfo) : undefined;

    if (directTradeMoq) {
      return { value: directTradeMoq, verified: true };
    }
  }

  const extracted = extractAlibabaMoqInfo(input.rawValue);
  if (extracted.verified && extracted.value) {
    return extracted;
  }

  const variantPricingMoq = deriveMoqFromTiers(input.variantPricing);
  if (variantPricingMoq) {
    return { value: variantPricingMoq, verified: true };
  }

  const tierMoq = deriveMoqFromTiers(input.tiers);
  if (tierMoq) {
    return { value: tierMoq, verified: true };
  }

  const fallback = normalizeMoqValue(input.fallback ?? Number.NaN);
  return fallback ? { value: fallback, verified: false } : { verified: false };
}