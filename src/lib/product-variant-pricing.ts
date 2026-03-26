import type { ProductCatalogItem, ProductTier, ProductVariantPrice, ProductVariantSku } from "@/lib/products-data";

type VariantSelection = Record<string, string>;
type VariantPricedProduct = Pick<ProductCatalogItem, "tiers"> & {
  variantPricing?: ProductVariantPrice[];
  minUsd?: number;
  maxUsd?: number;
  moq?: number;
};

export type ProductPriceSummaryUsd = {
  minUsd: number;
  maxUsd?: number;
  exact: boolean;
};

function getStringValue(candidate: unknown): string | undefined {
  if (typeof candidate === "string") {
    const trimmed = candidate.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (typeof candidate === "number" && Number.isFinite(candidate)) {
    return String(candidate);
  }

  return undefined;
}

function parsePositiveNumber(candidate: unknown) {
  if (typeof candidate === "number" && Number.isFinite(candidate) && candidate > 0) {
    return candidate;
  }

  if (typeof candidate !== "string") {
    return undefined;
  }

  const match = candidate.match(/\d+(?:[.,]\d+)?/);
  if (!match) {
    return undefined;
  }

  const value = Number(match[0].replace(",", "."));
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function parsePriceBounds(...candidates: unknown[]) {
  let minValue: number | undefined;
  let maxValue: number | undefined;

  for (const candidate of candidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate) && candidate > 0) {
      minValue = typeof minValue === "number" ? Math.min(minValue, candidate) : candidate;
      continue;
    }

    if (typeof candidate !== "string") {
      continue;
    }

    const matches = [...candidate.matchAll(/\d+(?:[.,]\d+)?/g)]
      .map((match) => Number(match[0].replace(",", ".")))
      .filter((value) => Number.isFinite(value) && value > 0);
    if (matches.length === 0) {
      continue;
    }

    const nextMin = Math.min(...matches);
    const nextMax = Math.max(...matches);
    minValue = typeof minValue === "number" ? Math.min(minValue, nextMin) : nextMin;
    if (matches.length > 1) {
      maxValue = typeof maxValue === "number" ? Math.max(maxValue, nextMax) : nextMax;
    }
  }

  return {
    min: minValue,
    ...(typeof maxValue === "number" && typeof minValue === "number" && maxValue > minValue ? { max: maxValue } : {}),
  };
}

function normalizeSelection(selection?: VariantSelection) {
  if (!selection) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(selection)
      .map(([label, value]) => [label.trim(), value.trim()] as const)
      .filter(([label, value]) => label.length > 0 && value.length > 0)
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

function serializeSelection(selection?: VariantSelection) {
  return JSON.stringify(normalizeSelection(selection));
}

function normalizeVariantText(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/[_]+/g, " ")
    .replace(/[\s\u00a0]+/g, " ")
    .replace(/^[\s:;|,./-]+|[\s:;|,./-]+$/g, "")
    .trim();
}

function normalizeVariantLabel(value: string) {
  return normalizeVariantText(value).replace(/[:：]\s*$/u, "");
}

function normalizeVariantValue(value: string) {
  return normalizeVariantText(value);
}

function isVariantLabelCandidate(value: string) {
  return value.length > 0 && !/^(sku|sku code|sku id|item id|product id|price|price range|min price|max price|moq|quantity|qty|unit|inventory|stock|weight|image|picture|photo|video|url|link|currency|lead time|model|model number)$/i.test(value);
}

function isVariantValueCandidate(value: string) {
  return value.length > 0 && value.length <= 80 && !/^https?:\/\//i.test(value);
}

function toVariantPair(label: string | undefined, value: string | undefined) {
  const normalizedLabel = label ? normalizeVariantLabel(label) : "";
  const normalizedValue = value ? normalizeVariantValue(value) : "";

  if (!isVariantLabelCandidate(normalizedLabel) || !isVariantValueCandidate(normalizedValue)) {
    return null;
  }

  return {
    label: normalizedLabel,
    value: normalizedValue,
  };
}

function extractVariantPairsFromString(value: string, fallbackLabel?: string) {
  const normalized = normalizeVariantText(value);
  if (!normalized) {
    return [];
  }

  const segments = normalized.split(/[;|]/g).map((segment) => segment.trim()).filter(Boolean);
  const pairs = segments.flatMap((segment) => {
    const match = segment.match(/^([^:=]{1,40})\s*[:=]\s*(.+)$/);
    if (!match) {
      return [];
    }

    const pair = toVariantPair(match[1], match[2]);
    return pair ? [pair] : [];
  });

  if (pairs.length > 0) {
    return pairs;
  }

  const fallbackPair = fallbackLabel ? toVariantPair(fallbackLabel, normalized) : null;
  return fallbackPair ? [fallbackPair] : [];
}

function extractVariantPairsFromAttribute(value: unknown, fallbackLabel?: string, depth = 0): Array<{ label: string; value: string }> {
  if (depth > 4 || value == null) {
    return [];
  }

  if (typeof value === "string") {
    return extractVariantPairsFromString(value, fallbackLabel);
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => extractVariantPairsFromAttribute(entry, fallbackLabel, depth + 1));
  }

  if (typeof value !== "object") {
    return [];
  }

  const record = value as Record<string, unknown>;
  const label = getStringValue(record.attribute_name)
    ?? getStringValue(record.attributeName)
    ?? getStringValue(record.attr_name)
    ?? getStringValue(record.attrName)
    ?? getStringValue(record.attr_name_desc)
    ?? getStringValue(record.attrNameDesc)
    ?? getStringValue(record.spec_name)
    ?? getStringValue(record.specName)
    ?? getStringValue(record.prop_name)
    ?? getStringValue(record.propName)
    ?? getStringValue(record.sale_attribute_name)
    ?? getStringValue(record.saleAttributeName)
    ?? getStringValue(record.label)
    ?? getStringValue(record.name)
    ?? getStringValue(record.key)
    ?? fallbackLabel;
  const directValue = getStringValue(record.attribute_value)
    ?? getStringValue(record.attributeValue)
    ?? getStringValue(record.attr_value)
    ?? getStringValue(record.attrValue)
    ?? getStringValue(record.attr_value_desc)
    ?? getStringValue(record.attrValueDesc)
    ?? getStringValue(record.value_name)
    ?? getStringValue(record.valueName)
    ?? getStringValue(record.option_name)
    ?? getStringValue(record.optionName)
    ?? getStringValue(record.display_value)
    ?? getStringValue(record.displayValue)
    ?? getStringValue(record.text)
    ?? (fallbackLabel ? getStringValue(record.value) : undefined);
  const directPair = toVariantPair(label, directValue);
  const nestedKeys = [
    "sale_attributes",
    "saleAttributes",
    "attributes",
    "attribute_list",
    "attributeList",
    "attribute_values",
    "attributeValues",
    "sku_attributes",
    "skuAttributes",
    "sku_attr_list",
    "skuAttrList",
    "spec_attrs",
    "specAttributes",
    "props",
    "properties",
    "options",
    "values",
    "items",
  ];

  return [
    ...(directPair ? [directPair] : []),
    ...nestedKeys.flatMap((key) => extractVariantPairsFromAttribute(record[key], label, depth + 1)),
  ];
}

function buildQuantityLabel(minimumQuantity?: number, maximumQuantity?: number) {
  if (typeof minimumQuantity === "number" && typeof maximumQuantity === "number" && maximumQuantity > minimumQuantity) {
    return `${minimumQuantity}-${maximumQuantity}`;
  }

  if (typeof minimumQuantity === "number") {
    return `${minimumQuantity}+`;
  }

  return undefined;
}

function getRuleMinimumQuantity(rule: Pick<ProductVariantPrice, "minimumQuantity" | "quantityLabel">) {
  if (typeof rule.minimumQuantity === "number" && rule.minimumQuantity > 0) {
    return rule.minimumQuantity;
  }

  const label = rule.quantityLabel ?? "";
  const rangeMatch = label.match(/(\d+)\s*[-~]/);
  if (rangeMatch) {
    return Number(rangeMatch[1]);
  }

  const singleMatch = label.match(/(\d+)/);
  return singleMatch ? Number(singleMatch[1]) : 1;
}

function getRuleMaximumQuantity(rule: Pick<ProductVariantPrice, "maximumQuantity" | "quantityLabel">) {
  if (typeof rule.maximumQuantity === "number" && rule.maximumQuantity > 0) {
    return rule.maximumQuantity;
  }

  const label = rule.quantityLabel ?? "";
  const rangeMatch = label.match(/[-~]\s*(\d+)/);
  return rangeMatch ? Number(rangeMatch[1]) : undefined;
}

function getRuleMinimumPrice(rule: Pick<ProductVariantPrice, "priceUsd" | "minPriceUsd">) {
  return rule.minPriceUsd ?? rule.priceUsd;
}

function getRuleMaximumPrice(rule: Pick<ProductVariantPrice, "priceUsd" | "minPriceUsd" | "maxPriceUsd">) {
  return rule.maxPriceUsd ?? rule.minPriceUsd ?? rule.priceUsd;
}

function buildPriceSummary(minUsd: number, maxUsd?: number): ProductPriceSummaryUsd {
  return {
    minUsd,
    ...(typeof maxUsd === "number" && maxUsd > minUsd ? { maxUsd } : {}),
    exact: typeof maxUsd !== "number" || Math.abs(maxUsd - minUsd) < 0.0001,
  };
}

function extractVariantSelectionFromSkuRecord(record: Record<string, unknown>) {
  const pairs = Object.entries(record)
    .filter(([key]) => /(sale|attr|spec|variant|prop)/i.test(key))
    .flatMap(([, value]) => extractVariantPairsFromAttribute(value));

  return normalizeSelection(Object.fromEntries(pairs.map((pair) => [pair.label, pair.value])));
}

function extractSkuImage(record: Record<string, unknown>) {
  const imageRecord = record.image && typeof record.image === "object" && !Array.isArray(record.image)
    ? record.image as Record<string, unknown>
    : null;
  const raw = getStringValue(imageRecord?.image_url)
    ?? getStringValue(imageRecord?.url)
    ?? getStringValue(record.image_url)
    ?? getStringValue(record.imageUrl);

  if (!raw) {
    return undefined;
  }

  return raw.startsWith("//") ? `https:${raw}` : raw;
}

function extractPriceRulesFromRecord(record: Record<string, unknown>, depth = 0): Array<Omit<ProductVariantPrice, "selections">> {
  if (depth > 4) {
    return [];
  }

  const priceBounds = parsePriceBounds(
    record.price,
    record.sale_price,
    record.salePrice,
    record.discount_price,
    record.discountPrice,
    record.unit_price,
    record.unitPrice,
    record.display_price,
    record.displayPrice,
    record.price_value,
    record.priceValue,
    record.price_range,
    record.priceRange,
    record.min_price,
    record.minPrice,
    record.max_price,
    record.maxPrice,
    record.sku_price && typeof record.sku_price === "object" ? (record.sku_price as Record<string, unknown>).price : undefined,
    record.sku_price && typeof record.sku_price === "object" ? (record.sku_price as Record<string, unknown>).min_price : undefined,
    record.sku_price && typeof record.sku_price === "object" ? (record.sku_price as Record<string, unknown>).max_price : undefined,
    record.range_price && typeof record.range_price === "object" ? (record.range_price as Record<string, unknown>).min_price : undefined,
    record.range_price && typeof record.range_price === "object" ? (record.range_price as Record<string, unknown>).max_price : undefined,
  );
  const directPrice = priceBounds.min;
  const minimumQuantity = parsePositiveNumber(record.begin_amount)
    ?? parsePositiveNumber(record.beginAmount)
    ?? parsePositiveNumber(record.min_order_quantity)
    ?? parsePositiveNumber(record.minOrderQuantity)
    ?? parsePositiveNumber(record.minimum_order_quantity)
    ?? parsePositiveNumber(record.minimumOrderQuantity)
    ?? parsePositiveNumber(record.quantity_min)
    ?? parsePositiveNumber(record.quantityMin)
    ?? parsePositiveNumber(record.min_qty)
    ?? parsePositiveNumber(record.minQty)
    ?? parsePositiveNumber(record.min_quantity)
    ?? parsePositiveNumber(record.minQuantity)
    ?? parsePositiveNumber(record.start_quantity)
    ?? parsePositiveNumber(record.startQuantity)
    ?? parsePositiveNumber(record.quantity)
    ?? parsePositiveNumber(record.qty)
    ?? parsePositiveNumber(record.from);
  const maximumQuantity = parsePositiveNumber(record.max_order_quantity)
    ?? parsePositiveNumber(record.maxOrderQuantity)
    ?? parsePositiveNumber(record.quantity_max)
    ?? parsePositiveNumber(record.quantityMax)
    ?? parsePositiveNumber(record.max_qty)
    ?? parsePositiveNumber(record.maxQty)
    ?? parsePositiveNumber(record.max_quantity)
    ?? parsePositiveNumber(record.maxQuantity)
    ?? parsePositiveNumber(record.end_quantity)
    ?? parsePositiveNumber(record.endQuantity)
    ?? parsePositiveNumber(record.to);

  const directRules = directPrice
    ? [{
        priceUsd: directPrice,
        minPriceUsd: directPrice,
        maxPriceUsd: priceBounds.max,
        minimumQuantity,
        maximumQuantity,
        quantityLabel: getStringValue(record.quantityLabel) ?? buildQuantityLabel(minimumQuantity, maximumQuantity),
        note: getStringValue(record.note),
      }]
    : [];

  const nestedKeys = ["price", "sku_price", "tiered_price", "range_price", "price_range", "price_info", "wholesale_trade", "tiers", "ladder", "ladder_price"];
  const nestedRules = nestedKeys.flatMap((key) => {
    const value = record[key];
    if (Array.isArray(value)) {
      return value.flatMap((entry) => entry && typeof entry === "object" && !Array.isArray(entry)
        ? extractPriceRulesFromRecord(entry as Record<string, unknown>, depth + 1)
        : []);
    }

    if (value && typeof value === "object" && !Array.isArray(value)) {
      return extractPriceRulesFromRecord(value as Record<string, unknown>, depth + 1);
    }

    return [];
  });

  return [...directRules, ...nestedRules];
}

export function extractAlibabaVariantPricing(rawPayload: unknown): ProductVariantPrice[] {
  const deduped = new Map<string, ProductVariantPrice>();
  const visited = new Set<object>();

  const visit = (value: unknown, depth = 0) => {
    if (depth > 5 || value == null) {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((entry) => visit(entry, depth + 1));
      return;
    }

    if (typeof value !== "object") {
      return;
    }

    const record = value as Record<string, unknown>;
    if (visited.has(record)) {
      return;
    }

    visited.add(record);

    const tradeInfo = (record.trade_info && typeof record.trade_info === "object") ? record.trade_info as Record<string, unknown> : {};
    const skuInfo = Array.isArray(record.sku_info)
      ? record.sku_info
      : Array.isArray(tradeInfo.sku_info)
        ? tradeInfo.sku_info
        : Array.isArray(record.skus)
          ? record.skus
          : [];

    skuInfo.forEach((sku) => {
      if (!sku || typeof sku !== "object" || Array.isArray(sku)) {
        return;
      }

      const skuRecord = sku as Record<string, unknown>;
      const selections = extractVariantSelectionFromSkuRecord(skuRecord);
      if (Object.keys(selections).length === 0) {
        return;
      }

      extractPriceRulesFromRecord(skuRecord).forEach((rule) => {
        if (!Number.isFinite(rule.priceUsd) || rule.priceUsd <= 0) {
          return;
        }

        const nextRule: ProductVariantPrice = {
          selections,
          priceUsd: rule.priceUsd,
          minPriceUsd: rule.minPriceUsd,
          maxPriceUsd: rule.maxPriceUsd,
          minimumQuantity: rule.minimumQuantity,
          maximumQuantity: rule.maximumQuantity,
          quantityLabel: rule.quantityLabel,
          note: rule.note,
        };
        const dedupeKey = [
          serializeSelection(selections),
          nextRule.priceUsd,
          nextRule.minPriceUsd ?? "",
          nextRule.maxPriceUsd ?? "",
          nextRule.minimumQuantity ?? "",
          nextRule.maximumQuantity ?? "",
          nextRule.quantityLabel ?? "",
        ].join("::");

        if (!deduped.has(dedupeKey)) {
          deduped.set(dedupeKey, nextRule);
        }
      });
    });

    Object.values(record).forEach((entry) => visit(entry, depth + 1));
  };

  visit(rawPayload);

  const rawRules = [...deduped.values()].sort((left, right) => {
    const leftSelection = serializeSelection(left.selections);
    const rightSelection = serializeSelection(right.selections);
    return leftSelection.localeCompare(rightSelection) || getRuleMinimumQuantity(left) - getRuleMinimumQuantity(right);
  });

  const varyingLabels = new Set<string>();
  const labelValues = new Map<string, Set<string>>();

  rawRules.forEach((rule) => {
    Object.entries(normalizeSelection(rule.selections)).forEach(([label, value]) => {
      const values = labelValues.get(label) ?? new Set<string>();
      values.add(value);
      labelValues.set(label, values);
    });
  });

  labelValues.forEach((values, label) => {
    if (values.size > 1) {
      varyingLabels.add(label);
    }
  });

  return rawRules.map((rule) => ({
    ...rule,
    selections: varyingLabels.size === 0
      ? normalizeSelection(rule.selections)
      : Object.fromEntries(
          Object.entries(normalizeSelection(rule.selections)).filter(([label]) => varyingLabels.has(label)),
        ),
  }));
}

export function extractAlibabaVariantSkus(rawPayload: unknown): ProductVariantSku[] {
  const deduped = new Map<string, ProductVariantSku>();
  const visited = new Set<object>();

  const visit = (value: unknown, depth = 0) => {
    if (depth > 5 || value == null) {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((entry) => visit(entry, depth + 1));
      return;
    }

    if (typeof value !== "object") {
      return;
    }

    const record = value as Record<string, unknown>;
    if (visited.has(record)) {
      return;
    }

    visited.add(record);

    const tradeInfo = (record.trade_info && typeof record.trade_info === "object") ? record.trade_info as Record<string, unknown> : {};
    const skuInfo = Array.isArray(record.sku_info)
      ? record.sku_info
      : Array.isArray(tradeInfo.sku_info)
        ? tradeInfo.sku_info
        : Array.isArray(record.skus)
          ? record.skus
          : [];

    skuInfo.forEach((sku) => {
      if (!sku || typeof sku !== "object" || Array.isArray(sku)) {
        return;
      }

      const skuRecord = sku as Record<string, unknown>;
      const selections = extractVariantSelectionFromSkuRecord(skuRecord);
      const skuId = getStringValue(skuRecord.sku_id) ?? getStringValue(skuRecord.skuId);
      if (!skuId || Object.keys(selections).length === 0) {
        return;
      }

      const nextSku: ProductVariantSku = {
        selections,
        skuId,
        skuCode: getStringValue(skuRecord.sku_code) ?? getStringValue(skuRecord.skuCode),
        inventory: parsePositiveNumber(skuRecord.inventory),
        image: extractSkuImage(skuRecord),
      };
      const dedupeKey = `${serializeSelection(selections)}::${skuId}`;
      if (!deduped.has(dedupeKey)) {
        deduped.set(dedupeKey, nextSku);
      }
    });

    Object.values(record).forEach((entry) => visit(entry, depth + 1));
  };

  visit(rawPayload);

  const rawSkus = [...deduped.values()].sort((left, right) => serializeSelection(left.selections).localeCompare(serializeSelection(right.selections)));
  const varyingLabels = new Set<string>();
  const labelValues = new Map<string, Set<string>>();

  rawSkus.forEach((variantSku) => {
    Object.entries(normalizeSelection(variantSku.selections)).forEach(([label, value]) => {
      const values = labelValues.get(label) ?? new Set<string>();
      values.add(value);
      labelValues.set(label, values);
    });
  });

  labelValues.forEach((values, label) => {
    if (values.size > 1) {
      varyingLabels.add(label);
    }
  });

  return rawSkus.map((variantSku) => ({
    ...variantSku,
    selections: varyingLabels.size === 0
      ? normalizeSelection(variantSku.selections)
      : Object.fromEntries(
          Object.entries(normalizeSelection(variantSku.selections)).filter(([label]) => varyingLabels.has(label)),
        ),
  }));
}

export function deriveVariantGroupsFromPricing(rules: ProductVariantPrice[]) {
  const groups = new Map<string, string[]>();

  rules.forEach((rule) => {
    Object.entries(normalizeSelection(rule.selections)).forEach(([label, value]) => {
      const existing = groups.get(label) ?? [];
      if (!existing.includes(value)) {
        existing.push(value);
        groups.set(label, existing);
      }
    });
  });

  return [...groups.entries()]
    .map(([label, values]) => ({ label, values }))
    .filter((group) => group.values.length > 1);
}

export function resolveVariantSku(product: Pick<ProductCatalogItem, "variantSkus">, selection?: VariantSelection) {
  const normalizedSelection = normalizeSelection(selection);
  const variantSkus = product.variantSkus ?? [];

  return variantSkus.find((variantSku) => {
    const ruleEntries = Object.entries(normalizeSelection(variantSku.selections));
    return ruleEntries.length > 0 && ruleEntries.every(([label, value]) => normalizedSelection[label] === value);
  });
}

function matchVariantRules(product: VariantPricedProduct, selection?: VariantSelection) {
  const normalizedSelection = normalizeSelection(selection);
  const rules = product.variantPricing ?? [];

  return rules.filter((rule) => {
    const ruleEntries = Object.entries(normalizeSelection(rule.selections));
    return ruleEntries.length > 0 && ruleEntries.every(([label, value]) => normalizedSelection[label] === value);
  });
}

function getTierMinimum(tier: Pick<ProductTier, "quantityLabel">) {
  const normalized = tier.quantityLabel.replace(/\s/g, "");
  if (normalized.startsWith(">=") || normalized.includes("+")) {
    const match = normalized.match(/(\d+)/);
    return match ? Number(match[1]) : 0;
  }

  const rangeMatch = normalized.match(/(\d+)-(\d+)/);
  if (rangeMatch) {
    return Number(rangeMatch[1]);
  }

  const singleMatch = normalized.match(/(\d+)/);
  return singleMatch ? Number(singleMatch[1]) : 0;
}

export function getApplicableVariantPricing(product: VariantPricedProduct, selection?: VariantSelection) {
  const matchedRules = matchVariantRules(product, selection);
  if (matchedRules.length === 0) {
    return [];
  }

  return [...matchedRules].sort((left, right) => getRuleMinimumQuantity(left) - getRuleMinimumQuantity(right));
}

export function getDisplayPriceTiers(product: VariantPricedProduct, selection?: VariantSelection) {
  const variantRules = getApplicableVariantPricing(product, selection);
  if (variantRules.length === 0) {
    return product.tiers;
  }

  return variantRules.map((rule) => ({
    quantityLabel: rule.quantityLabel ?? buildQuantityLabel(rule.minimumQuantity, rule.maximumQuantity) ?? "1+",
    priceUsd: getRuleMinimumPrice(rule),
    note: rule.note ?? (typeof rule.maxPriceUsd === "number" && rule.maxPriceUsd > getRuleMinimumPrice(rule)
      ? `Jusqu'a ${rule.maxPriceUsd.toFixed(2)} USD`
      : undefined),
  }));
}

export function resolveProductPriceSummaryUsd(product: VariantPricedProduct, input?: {
  quantity?: number;
  selection?: VariantSelection;
}) {
  const quantity = Math.max(1, input?.quantity ?? product.moq ?? 1);
  const variantRules = getApplicableVariantPricing(product, input?.selection);

  if (variantRules.length > 0) {
    const matchedByQuantity = variantRules.filter((rule) => {
      const minimum = getRuleMinimumQuantity(rule);
      const maximum = getRuleMaximumQuantity(rule);
      return quantity >= minimum && (typeof maximum !== "number" || quantity <= maximum);
    });
    const activeRules = matchedByQuantity.length > 0 ? matchedByQuantity : variantRules;
    const minUsd = Math.min(...activeRules.map((rule) => getRuleMinimumPrice(rule)));
    const maxUsd = Math.max(...activeRules.map((rule) => getRuleMaximumPrice(rule)));
    return buildPriceSummary(minUsd, maxUsd);
  }

  const sortedTiers = [...product.tiers].sort((left, right) => getTierMinimum(left) - getTierMinimum(right));
  const activeTier = [...sortedTiers].reverse().find((tier) => quantity >= getTierMinimum(tier)) ?? sortedTiers[0];
  if (activeTier) {
    return buildPriceSummary(activeTier.priceUsd);
  }

  return buildPriceSummary(product.minUsd ?? 0, product.maxUsd);
}

export function resolveProductUnitPriceUsd(product: VariantPricedProduct, input?: {
  quantity?: number;
  selection?: VariantSelection;
}) {
  return resolveProductPriceSummaryUsd(product, input).minUsd;
}
