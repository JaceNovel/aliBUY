import { createHmac } from "node:crypto";

import type { SourcingOrder, AlibabaCatalogMapping } from "@/lib/alibaba-sourcing";
import { createAlibabaIntegrationLog } from "@/lib/sourcing-store";

type AlibabaCredentials = {
  appKey: string;
  appSecret: string;
  accessToken?: string;
  apiBaseUrl: string;
};

type AlibabaCallResult = {
  ok: boolean;
  endpoint: string;
  requestBody: Record<string, unknown>;
  responseBody: unknown;
};

function getAlibabaCredentials(): AlibabaCredentials | null {
  const appKey = process.env.ALIBABA_OPEN_PLATFORM_APP_KEY;
  const appSecret = process.env.ALIBABA_OPEN_PLATFORM_APP_SECRET;

  if (!appKey || !appSecret) {
    return null;
  }

  return {
    appKey,
    appSecret,
    accessToken: process.env.ALIBABA_OPEN_PLATFORM_ACCESS_TOKEN,
    apiBaseUrl: process.env.ALIBABA_OPEN_PLATFORM_API_BASE_URL ?? "https://openapi-api.alibaba.com",
  };
}

function serializeValue(value: unknown) {
  if (value === null || typeof value === "undefined") {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
}

function signAlibabaRequest(pathname: string, params: URLSearchParams, secret: string) {
  const sortedEntries = [...params.entries()].filter(([key]) => key !== "sign").sort(([left], [right]) => left.localeCompare(right));
  const baseString = pathname + sortedEntries.map(([key, value]) => `${key}${value}`).join("");

  return createHmac("sha256", secret).update(baseString, "utf8").digest("hex").toUpperCase();
}

async function callAlibabaEndpoint(pathname: string, payload: Record<string, unknown>, accessToken?: string): Promise<AlibabaCallResult> {
  const credentials = getAlibabaCredentials();
  if (!credentials) {
    return {
      ok: false,
      endpoint: pathname,
      requestBody: payload,
      responseBody: { message: "Alibaba credentials are missing" },
    };
  }

  const params = new URLSearchParams();
  params.set("app_key", credentials.appKey);
  params.set("timestamp", String(Date.now()));
  params.set("sign_method", "HMAC_SHA256");
  if (accessToken ?? credentials.accessToken) {
    params.set("access_token", accessToken ?? credentials.accessToken ?? "");
  }

  for (const [key, value] of Object.entries(payload)) {
    params.set(key, serializeValue(value));
  }

  params.set("sign", signAlibabaRequest(pathname, params, credentials.appSecret));

  const response = await fetch(`${credentials.apiBaseUrl}${pathname}`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
    },
    body: params.toString(),
    cache: "no-store",
  });
  const text = await response.text();

  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Keep raw text when the upstream response is not JSON.
  }

  return {
    ok: response.ok,
    endpoint: pathname,
    requestBody: payload,
    responseBody: parsed,
  };
}

function groupMappingsForOrder(order: SourcingOrder, mappings: AlibabaCatalogMapping[]) {
  const enrichedItems = order.items.map((item) => ({
    item,
    mapping: mappings.find((mapping) => mapping.slug === item.slug),
  }));
  const missingMappings = enrichedItems.filter((entry) => !entry.mapping?.alibabaProductId || !entry.mapping?.supplierCompanyId);

  const groups = new Map<string, typeof enrichedItems>();
  for (const entry of enrichedItems) {
    if (!entry.mapping?.supplierCompanyId) {
      continue;
    }

    const key = entry.mapping.supplierCompanyId;
    const current = groups.get(key) ?? [];
    groups.set(key, [...current, entry]);
  }

  return {
    missingMappings,
    groups: [...groups.entries()],
  };
}

export async function runAlibabaSupplierAutomation(order: SourcingOrder, mappings: AlibabaCatalogMapping[]) {
  const credentials = getAlibabaCredentials();
  const { missingMappings, groups } = groupMappingsForOrder(order, mappings);

  if (!credentials) {
    await createAlibabaIntegrationLog({
      orderId: order.id,
      action: "supplier-automation",
      endpoint: "env",
      status: "skipped_missing_credentials",
      requestBody: { orderNumber: order.orderNumber },
      responseBody: { message: "Missing ALIBABA_OPEN_PLATFORM_APP_KEY or ALIBABA_OPEN_PLATFORM_APP_SECRET" },
    });

    return {
      freightStatus: "skipped" as const,
      supplierOrderStatus: "skipped" as const,
      alibabaTradeIds: [] as string[],
      freightPayload: { skipped: true, reason: "missing_credentials" },
      supplierOrderPayload: { skipped: true, reason: "missing_credentials" },
    };
  }

  if (missingMappings.length > 0) {
    await createAlibabaIntegrationLog({
      orderId: order.id,
      action: "supplier-automation",
      endpoint: "catalog-mapping",
      status: "skipped_missing_mapping",
      requestBody: { missingSlugs: missingMappings.map((entry) => entry.item.slug) },
      responseBody: { message: "One or more cart items are missing Alibaba mapping data" },
    });

    return {
      freightStatus: "skipped" as const,
      supplierOrderStatus: "skipped" as const,
      alibabaTradeIds: [] as string[],
      freightPayload: { skipped: true, reason: "missing_mapping", missingSlugs: missingMappings.map((entry) => entry.item.slug) },
      supplierOrderPayload: { skipped: true, reason: "missing_mapping", missingSlugs: missingMappings.map((entry) => entry.item.slug) },
    };
  }

  const freightResponses: unknown[] = [];
  const supplierResponses: unknown[] = [];
  const tradeIds: string[] = [];
  let freightStatus: "verified" | "failed" = "verified";
  let supplierOrderStatus: "created" | "failed" = "created";

  for (const [supplierCompanyId, group] of groups) {
    const freightPayload = {
      e_company_id: supplierCompanyId,
      country: order.countryCode,
      province: order.state,
      city: order.city,
      address: [order.addressLine1, order.addressLine2].filter(Boolean).join(", "),
      zip: order.postalCode ?? "",
      dispatch_location: group[0]?.mapping?.dispatchLocation ?? "CN",
      logistics_product_list: group.map((entry) => ({
        product_id: entry.mapping?.alibabaProductId,
        sku_id: entry.mapping?.skuId ?? "",
        quantity: entry.item.quantity,
      })),
    };

    const freightResult = await callAlibabaEndpoint("/order/freight/calculate", freightPayload);
    freightResponses.push(freightResult.responseBody);
    await createAlibabaIntegrationLog({
      orderId: order.id,
      action: "freight-verification",
      endpoint: freightResult.endpoint,
      status: freightResult.ok ? "success" : "failed",
      requestBody: freightPayload,
      responseBody: freightResult.responseBody,
    });

    if (!freightResult.ok) {
      freightStatus = "failed";
      supplierOrderStatus = "failed";
      continue;
    }

    const supplierPayload = {
      country: order.countryCode,
      flow: "general",
      logistics_detail: {
        dispatch_location: group[0]?.mapping?.dispatchLocation ?? "CN",
        shipment_address: {
          address: order.addressLine1,
          address2: order.addressLine2 ?? "",
          city: order.city,
          province: order.state,
          country: order.countryCode,
          zip: order.postalCode ?? "",
          phone: order.customerPhone,
          full_name: order.customerName,
        },
      },
      product_list: group.map((entry) => ({
        product_id: entry.mapping?.alibabaProductId,
        sku_id: entry.mapping?.skuId ?? "",
        quantity: entry.item.quantity,
      })),
      remark: `Internal order ${order.orderNumber}`,
      external_reference: order.orderNumber,
    };

    const supplierResult = await callAlibabaEndpoint("/buynow/order/create", supplierPayload);
    supplierResponses.push(supplierResult.responseBody);
    await createAlibabaIntegrationLog({
      orderId: order.id,
      action: "supplier-order-create",
      endpoint: supplierResult.endpoint,
      status: supplierResult.ok ? "success" : "failed",
      requestBody: supplierPayload,
      responseBody: supplierResult.responseBody,
    });

    if (!supplierResult.ok) {
      supplierOrderStatus = "failed";
      continue;
    }

    const resultObject = supplierResult.responseBody as { trade_id?: string; data?: { trade_id?: string } };
    const tradeId = resultObject?.trade_id ?? resultObject?.data?.trade_id;
    if (tradeId) {
      tradeIds.push(String(tradeId));
    }
  }

  return {
    freightStatus,
    supplierOrderStatus,
    alibabaTradeIds: tradeIds,
    freightPayload: freightResponses,
    supplierOrderPayload: supplierResponses,
  };
}