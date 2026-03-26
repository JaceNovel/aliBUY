import "server-only";

import { randomBytes } from "node:crypto";

import type { AuthenticatedUser } from "@/lib/user-auth";
import type { ProductCatalogItem } from "@/lib/products-data";
import {
  getSourcingOrderMeta,
  getProductSourcingMetrics,
  withSourcingOrderMeta,
  type SourcingOrder,
} from "@/lib/alibaba-sourcing";
import { createAlibabaSupplierOrders, verifyAlibabaSupplierFreight } from "@/lib/alibaba-open-platform-client";
import {
  getFreeDealConfig,
  getFreeDealFixedPriceFcfa,
  getFreeDealProducts,
  isAllowedFreeDealProductSelection,
  resolveFreeDealIdentity,
  type FreeDealConfig,
  type FreeDealVisitorIdentity,
} from "@/lib/free-deal-store";
import { createAlibabaIntegrationLog, getAlibabaCatalogMappings, saveSourcingOrder } from "@/lib/sourcing-store";

export type FreeDealCheckoutCustomerInput = {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode?: string;
  countryCode: string;
};

function nowIso() {
  return new Date().toISOString();
}

function createFreeDealOrderNumber() {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `FDP-${stamp}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

function sumNumbers(values: number[]) {
  return Number(values.reduce((total, value) => total + value, 0).toFixed(3));
}

function normalizeCountryCode(value: string) {
  const normalized = value.trim().toUpperCase();
  return normalized || "FR";
}

function normalizeSelectedProducts(config: FreeDealConfig, selectedSlugs: string[], products: ProductCatalogItem[]) {
  if (!isAllowedFreeDealProductSelection(config, selectedSlugs)) {
    throw new Error(`Vous devez choisir exactement ${config.itemLimit} article(s) eligibles.`);
  }

  const productMap = new Map(products.map((product) => [product.slug, product]));
  const selectedProducts = selectedSlugs
    .map((slug) => productMap.get(slug) ?? null)
    .filter((product): product is ProductCatalogItem => product !== null);

  if (selectedProducts.length !== config.itemLimit) {
    throw new Error("Certains produits choisis ne sont plus disponibles dans cette offre.");
  }

  return selectedProducts;
}

export async function createFreeDealOrder(input: {
  config?: FreeDealConfig;
  selectedSlugs: string[];
  customer: FreeDealCheckoutCustomerInput;
  visitor: FreeDealVisitorIdentity;
  user?: AuthenticatedUser | null;
}) {
  const config = input.config ?? await getFreeDealConfig();
  if (!config.enabled || config.productSlugs.length === 0) {
    throw new Error("Cette offre est actuellement indisponible.");
  }

  const products = await getFreeDealProducts(config);
  const selectedProducts = normalizeSelectedProducts(config, input.selectedSlugs, products);

  const timestamp = nowIso();
  const fixedPriceFcfa = getFreeDealFixedPriceFcfa(config);
  const identity = resolveFreeDealIdentity({
    ...input.visitor,
    userId: input.user?.id ?? input.visitor.userId,
    customerEmail: input.customer.customerEmail,
  });

  let order: SourcingOrder = {
    id: `fdo_${randomBytes(10).toString("hex")}`,
    orderNumber: createFreeDealOrderNumber(),
    userId: input.user?.id,
    customerName: input.customer.customerName.trim(),
    customerEmail: input.customer.customerEmail.trim().toLowerCase(),
    customerPhone: input.customer.customerPhone.trim(),
    addressLine1: input.customer.addressLine1.trim(),
    addressLine2: input.customer.addressLine2?.trim() || undefined,
    city: input.customer.city.trim(),
    state: input.customer.state.trim() || input.customer.city.trim(),
    postalCode: input.customer.postalCode?.trim() || undefined,
    countryCode: normalizeCountryCode(input.customer.countryCode),
    shippingMethod: "sea",
    shippingCostFcfa: 0,
    cartProductsTotalFcfa: fixedPriceFcfa,
    totalPriceFcfa: fixedPriceFcfa,
    totalWeightKg: sumNumbers(selectedProducts.map((product) => getProductSourcingMetrics(product).weightKg)),
    totalVolumeCbm: sumNumbers(selectedProducts.map((product) => getProductSourcingMetrics(product).volumeCbm)),
    status: "grouped_sea",
    freightStatus: "not_requested",
    supplierOrderStatus: "not_created",
    paymentStatus: "unpaid",
    paymentProvider: "moneroo",
    paymentCurrency: "XOF",
    alibabaTradeIds: [],
    createdAt: timestamp,
    updatedAt: timestamp,
    items: selectedProducts.map((product) => {
      const metrics = getProductSourcingMetrics(product);

      return {
        slug: product.slug,
        title: product.shortTitle,
        quantity: 1,
        weightKg: metrics.weightKg,
        volumeCbm: metrics.volumeCbm,
        supplierPriceFcfa: 0,
        marginMode: "fixed",
        marginValue: 0,
        marginAmountFcfa: 0,
        finalUnitPriceFcfa: 0,
        finalLinePriceFcfa: 0,
        image: product.image,
      };
    }),
  };

  order = withSourcingOrderMeta(order, {
    freeDeal: {
      campaignKey: "free-deal",
      fixedPriceEur: config.fixedPriceEur,
      fixedPriceFcfa,
      itemLimit: config.itemLimit,
      referralGoal: config.referralGoal,
      selectedProductSlugs: input.selectedSlugs,
      deviceIdHash: identity.deviceIdHash,
      ipHash: identity.ipHash,
      userAgentHash: identity.userAgentHash,
    },
    paymentContext: {
      payerUserId: input.user?.id,
      payerDisplayName: input.user?.displayName || input.customer.customerName.trim(),
      payerEmail: input.user?.email || input.customer.customerEmail.trim().toLowerCase(),
      createdFromSharedCart: false,
    },
  });

  await saveSourcingOrder(order);

  const mappings = await getAlibabaCatalogMappings();
  try {
    const freightVerification = await verifyAlibabaSupplierFreight(order, mappings);
    order = {
      ...order,
      freightStatus: freightVerification.freightStatus,
      freightPayload: freightVerification.freightPayload,
      updatedAt: nowIso(),
    };
    await saveSourcingOrder(order);

    const supplierOrders = await createAlibabaSupplierOrders(order, mappings, freightVerification);
    const currentMeta = getSourcingOrderMeta(order);
    order = withSourcingOrderMeta({
      ...order,
      supplierOrderStatus: supplierOrders.supplierOrderStatus,
      alibabaTradeIds: supplierOrders.alibabaTradeIds,
      supplierOrderPayload: supplierOrders.supplierOrderPayload,
      updatedAt: nowIso(),
    }, currentMeta);
  } catch (error) {
    const message = error instanceof Error ? error.message : "free_deal_supplier_automation_failed";
    const currentMeta = getSourcingOrderMeta(order);
    order = withSourcingOrderMeta({
      ...order,
      freightStatus: "failed",
      supplierOrderStatus: "failed",
      supplierOrderPayload: { error: message },
      updatedAt: nowIso(),
    }, currentMeta);

    await createAlibabaIntegrationLog({
      orderId: order.id,
      action: "free-deal-supplier-automation",
      endpoint: "internal",
      status: "failed",
      requestBody: {
        orderNumber: order.orderNumber,
        shippingMethod: order.shippingMethod,
      },
      responseBody: { message },
    });
  }

  await saveSourcingOrder(order);
  return order;
}

export function resolveRequestOrigin(headers: Pick<Headers, "get">) {
  const protocol = headers.get("x-forwarded-proto") || "https";
  const host = headers.get("x-forwarded-host") || headers.get("host") || "localhost:3000";
  return `${protocol}://${host}`;
}

export function resolveRequestIp(headers: Pick<Headers, "get">) {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const firstIp = forwarded.split(",")[0]?.trim();
    if (firstIp) {
      return firstIp;
    }
  }

  return headers.get("x-real-ip")
    || headers.get("cf-connecting-ip")
    || headers.get("x-vercel-forwarded-for")
    || null;
}

export function isFreeDealOrder(order: Pick<SourcingOrder, "supplierOrderPayload">) {
  return Boolean(getSourcingOrderMeta(order).freeDeal);
}
