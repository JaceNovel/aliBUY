import {
  normalizeAlibabaFreightOptions,
  queryAliExpressDsFreight,
} from "@/lib/alibaba-open-platform-client";

export type DraftOrderItem = {
  product_id?: string;
  sku_attr?: string;
  qty?: number;
  logistics_service_name?: string;
  memo?: string;
};

export type DraftOrderInput = {
  id?: string | number;
  local_order_id?: string | number;
  shipping_address?: Record<string, unknown>;
  items?: DraftOrderItem[];
};

function asString(value: unknown) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function phoneDigits(value: string) {
  return value.replace(/\D+/g, "");
}

function outOrderId(source: string) {
  return `ds-${source.replace(/[^a-zA-Z0-9-]/g, "-").slice(0, 61)}`;
}

export function extractSelectedSkuId(skuAttr: string) {
  const match = skuAttr.match(/\d+/);
  return match?.[0];
}

export function normalizeAliExpressDsAddress(address: Record<string, unknown> | undefined) {
  const locale = process.env.ALIEXPRESS_DEFAULT_LOCALE || process.env.ALIEXPRESS_DEFAULT_LANGUAGE || "fr_FR";
  const country = asString(address?.country || address?.countryCode || process.env.ALIEXPRESS_DS_SHIP_TO_COUNTRY || "FR").trim().toUpperCase();

  return Object.fromEntries(Object.entries({
    country,
    province: asString(address?.province || address?.state),
    city: asString(address?.city),
    address: asString(address?.address || address?.address1 || address?.addressLine1),
    address2: asString(address?.address2 || address?.addressLine2),
    zip: asString(address?.zip || address?.postalCode),
    contact_person: asString(address?.contact_person || address?.contactName),
    full_name: asString(address?.full_name || address?.fullName || address?.contactName),
    mobile_no: phoneDigits(asString(address?.mobile_no || address?.mobileNo || address?.phone)),
    phone: phoneDigits(asString(address?.phone)),
    phone_country: asString(address?.phone_country || address?.phoneCountry || "+33"),
    locale,
  }).filter(([, value]) => value !== ""));
}

export function buildAliExpressDsDraft(order: DraftOrderInput) {
  const items = Array.isArray(order.items) ? order.items : [];
  if (items.length === 0) {
    throw new Error("Aucun item a commander.");
  }

  const productItems = items.map((line, index) => {
    const productId = asString(line.product_id).trim();
    const skuAttr = asString(line.sku_attr).trim();
    if (!productId) {
      throw new Error(`Ligne #${index + 1}: product_id manquant.`);
    }
    if (!skuAttr) {
      throw new Error(`Ligne #${index + 1}: sku_attr manquant.`);
    }

    return {
      product_id: productId,
      sku_attr: skuAttr,
      product_count: String(Math.max(1, Number(line.qty ?? 1) || 1)),
      logistics_service_name: asString(line.logistics_service_name || process.env.ALIEXPRESS_DS_DEFAULT_LOGISTICS || "AliExpress Selection Standard"),
      order_memo: asString(line.memo || `Order #${order.id ?? "N/A"}`),
    };
  });

  return {
    ds_extend_request: {
      payment: {
        pay_currency: process.env.ALIEXPRESS_DS_PAYMENT_CURRENCY || "USD",
        try_to_pay: "true",
      },
    },
    param_place_order_request4_open_api_d_t_o: {
      out_order_id: outOrderId(asString(order.id || Date.now())),
      logistics_address: normalizeAliExpressDsAddress(order.shipping_address),
      product_items: productItems,
    },
  };
}

function normalizeServiceName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/expedition standard aliexpress|aliexpress standard shipping|aliexpress selection standard/g, "aliexpress-standard")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function resolveAliExpressDsServiceName(requested: string, available: string[]) {
  if (!requested.trim()) {
    return available[0] ?? null;
  }

  const exact = available.find((name) => name.toLowerCase() === requested.toLowerCase());
  if (exact) {
    return exact;
  }

  const alias = normalizeServiceName(requested);
  return available.find((name) => normalizeServiceName(name) === alias) ?? null;
}

export async function runAliExpressDsFreightPrecheck(order: DraftOrderInput, draft: ReturnType<typeof buildAliExpressDsDraft>) {
  const productItems = Array.isArray(draft.param_place_order_request4_open_api_d_t_o.product_items)
    ? draft.param_place_order_request4_open_api_d_t_o.product_items
    : [];

  const checks = await Promise.all(productItems.map(async (item, index) => {
    const productId = asString(item.product_id).trim();
    const skuAttr = asString(item.sku_attr).trim();
    const requestedService = asString(item.logistics_service_name).trim();

    if (!productId || !skuAttr) {
      return {
        index,
        success: false,
        error_message: "product_id ou sku_attr manquant.",
      };
    }

    try {
      const freightResult = await queryAliExpressDsFreight({
        productId,
        quantity: asString(item.product_count || "1"),
        shipToCountry: asString((order.shipping_address as Record<string, unknown> | undefined)?.country || (order.shipping_address as Record<string, unknown> | undefined)?.countryCode || process.env.ALIEXPRESS_DS_SHIP_TO_COUNTRY || "FR"),
        selectedSkuId: extractSelectedSkuId(skuAttr),
        currency: asString(draft.ds_extend_request.payment.pay_currency || "USD"),
        locale: process.env.ALIEXPRESS_DEFAULT_LOCALE || process.env.ALIEXPRESS_DEFAULT_LANGUAGE || "fr_FR",
      });

      const available = normalizeAlibabaFreightOptions(freightResult.responseBody)
        .map((entry: { vendorName?: string; shippingType?: string }) => entry.vendorName || entry.shippingType || "")
        .filter((name: string): name is string => Boolean(name));
      const resolved = resolveAliExpressDsServiceName(requestedService, available);

      return {
        index,
        success: freightResult.ok,
        requested_logistics_service_name: requestedService,
        resolved_logistics_service_name: resolved,
        available_services: Array.from(new Set(available)),
        is_valid: resolved !== null,
        request_payload: {
          productId,
          selectedSkuId: extractSelectedSkuId(skuAttr),
          quantity: asString(item.product_count || "1"),
        },
        response: freightResult.responseBody,
      };
    } catch (error) {
      return {
        index,
        success: false,
        error_message: error instanceof Error ? error.message : "Freight precheck impossible.",
      };
    }
  }));

  return {
    checked_at: new Date().toISOString(),
    items: checks,
  };
}

export function getAliExpressDsFreightFailure(freightCheck: { items?: Array<Record<string, unknown>> }) {
  const items = Array.isArray(freightCheck.items) ? freightCheck.items : [];

  for (const item of items) {
    if (item.success === false) {
      return `Freight precheck KO: ${asString(item.error_message || "erreur inconnue")}`;
    }

    if (item.is_valid === false) {
      return "Freight precheck KO: service logistique invalide pour au moins une ligne.";
    }
  }

  return null;
}

export function applyResolvedAliExpressDsLogistics(
  draft: ReturnType<typeof buildAliExpressDsDraft>,
  freightCheck: { items?: Array<Record<string, unknown>> },
) {
  const items = Array.isArray(draft.param_place_order_request4_open_api_d_t_o.product_items)
    ? [...draft.param_place_order_request4_open_api_d_t_o.product_items]
    : [];
  const checks = Array.isArray(freightCheck.items) ? freightCheck.items : [];

  for (const [index, item] of items.entries()) {
    const resolved = asString(checks[index]?.resolved_logistics_service_name).trim();
    if (resolved) {
      items[index] = {
        ...item,
        logistics_service_name: resolved,
      };
    }
  }

  return {
    ...draft,
    param_place_order_request4_open_api_d_t_o: {
      ...draft.param_place_order_request4_open_api_d_t_o,
      product_items: items,
    },
  };
}
