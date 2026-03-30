import {
  normalizeAlibabaFreightOptions,
  queryAliExpressDsFreight,
} from "../../../../../lib/alibaba-open-platform-client";

type DraftOrderItem = {
  product_id?: string;
  sku_attr?: string;
  qty?: number;
  logistics_service_name?: string;
  memo?: string;
};

type DraftOrderInput = {
  id?: string | number;
  shipping_address?: Record<string, unknown>;
  items?: DraftOrderItem[];
};

function asString(value: unknown) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function buildDraft(order: DraftOrderInput) {
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
      logistics_service_name: asString(line.logistics_service_name || "AliExpress Selection Standard"),
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
      out_order_id: `ds-${asString(order.id || Date.now()).replace(/[^a-zA-Z0-9-]/g, "-").slice(0, 61)}`,
      logistics_address: order.shipping_address && typeof order.shipping_address === "object"
        ? order.shipping_address
        : {},
      product_items: productItems,
    },
  };
}

function extractSelectedSkuId(skuAttr: string) {
  const match = skuAttr.match(/\d+/);
  return match?.[0];
}

function normalizeServiceName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/expedition standard aliexpress|aliexpress standard shipping|aliexpress selection standard/g, "aliexpress-standard")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function resolveServiceName(requested: string, available: string[]) {
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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const order = body && typeof body === "object" ? body as DraftOrderInput : {};
    const draft = buildDraft(order);

    const productItems = Array.isArray(draft.param_place_order_request4_open_api_d_t_o.product_items)
      ? draft.param_place_order_request4_open_api_d_t_o.product_items
      : [];

    const checks = await Promise.all(productItems.map(async (item, index) => {
      const productId = asString(item.product_id).trim();
      const skuAttr = asString(item.sku_attr).trim();
      const requestedService = asString(item.logistics_service_name).trim();

      try {
        const freightResult = await queryAliExpressDsFreight({
          productId,
          quantity: asString(item.product_count || "1"),
          shipToCountry: asString((order.shipping_address as Record<string, unknown> | undefined)?.country || process.env.ALIEXPRESS_DS_SHIP_TO_COUNTRY || "FR"),
          selectedSkuId: extractSelectedSkuId(skuAttr),
          currency: asString(draft.ds_extend_request.payment.pay_currency || "USD"),
          locale: process.env.ALIEXPRESS_DEFAULT_LOCALE || "fr_FR",
        });

        const available = normalizeAlibabaFreightOptions(freightResult.responseBody)
          .map((entry: { vendorName?: string; shippingType?: string }) => entry.vendorName || entry.shippingType || "")
          .filter((name: string): name is string => Boolean(name));
        const resolved = resolveServiceName(requestedService, available);

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

    return Response.json({
      draft,
      freight_check: {
        checked_at: new Date().toISOString(),
        items: checks,
      },
    });
  } catch (error) {
    return Response.json({
      message: error instanceof Error ? error.message : "Generation du draft DS impossible.",
    }, { status: 400 });
  }
}
