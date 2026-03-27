import { SITE_URL } from "@/lib/site-config";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").trim().replace(/\/$/, "");
const SERVER_FALLBACK_API_URL = API_URL || SITE_URL.replace(/\/$/, "");

export const PRODUCTS_FEED_PAGE_SIZE = 20;

export type ProductFeedItem = {
  slug: string;
  title: string;
  image: string;
  badge?: string;
  minUsd: number;
  maxUsd?: number;
  moq: number;
  unit: string;
};

export type ProductFeedPage = {
  items: ProductFeedItem[];
  page: number;
  nextPage: number | null;
  hasMore: boolean;
  pageSize: number;
  source: string;
  query?: string;
  category?: string;
  mode?: string;
};

export type ProductFeedCategoryOption = {
  slug: string;
  title: string;
  productCount?: number;
};

export type ProductFeedCategorySummary = {
  slug: string;
  title: string;
  productCount: number;
};

export type ProductTier = {
  quantityLabel: string;
  priceUsd: number;
  note?: string;
};

export type ProductVariantPricingRule = {
  selections: Record<string, string>;
  priceUsd?: number;
  minPriceUsd?: number;
  maxPriceUsd?: number;
  minimumQuantity?: number;
  maximumQuantity?: number;
  quantityLabel?: string;
  note?: string;
};

export type ProductSpec = {
  label: string;
  value: string;
};

export type ProductVariantGroup = {
  label: string;
  values: string[];
};

export type CatalogProduct = {
  slug: string;
  title: string;
  shortTitle: string;
  image: string;
  gallery: string[];
  videoUrl?: string;
  videoPoster?: string;
  badge?: string;
  minUsd: number;
  maxUsd?: number;
  moq: number;
  moqVerified?: boolean;
  unit: string;
  packaging: string;
  itemWeightGrams: number;
  lotCbm: string;
  supplierName: string;
  supplierLocation: string;
  responseTime: string;
  yearsInBusiness: number;
  transactionsLabel: string;
  soldLabel: string;
  customizationLabel: string;
  shippingLabel: string;
  overview: string[];
  tiers: ProductTier[];
  variantGroups: ProductVariantGroup[];
  variantPricing?: ProductVariantPricingRule[];
  specs: ProductSpec[];
  keywords?: string[];
};

export type CustomerAddressRecord = {
  id: string;
  userId: string;
  label: string;
  recipientName: string;
  phone: string;
  email?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode?: string;
  countryCode: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ApiOrderItem = {
  id?: string;
  title?: string;
  productName?: string;
  image?: string;
  quantity: number;
};

export type ApiOrder = {
  id: string;
  orderNumber: string;
  userId?: string;
  customerEmail: string;
  customerName: string;
  customerPhone?: string;
  shippingMethod: "air" | "sea" | "freight";
  totalPriceFcfa: number;
  paymentStatus: "unpaid" | "initialized" | "pending" | "paid" | "failed" | "cancelled";
  paymentCurrency: string;
  monerooPaymentId?: string;
  monerooCheckoutUrl?: string;
  monerooPaymentStatus?: string;
  createdAt: string;
  items: ApiOrderItem[];
  meta?: {
    promo?: {
      code: string;
      discountFcfa: number;
      baseTotalFcfa: number;
      finalTotalFcfa: number;
    };
    paymentContext?: {
      createdFromSharedCart?: boolean;
      thirdPartyCreatorName?: string;
    };
  };
};

type ApiRequestOptions = RequestInit & {
  query?: Record<string, string | number | boolean | null | undefined>;
};

function getApiBaseUrl() {
  if (typeof window !== "undefined") {
    return API_URL;
  }

  return SERVER_FALLBACK_API_URL;
}

export function buildApiUrl(path: string, query?: Record<string, string | number | boolean | null | undefined>) {
  const baseUrl = getApiBaseUrl();
  const target = path.startsWith("http://") || path.startsWith("https://")
    ? new URL(path)
    : baseUrl
      ? new URL(path.startsWith("/") ? path : `/${path}`, `${baseUrl}/`)
      : new URL(path, window.location.origin);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && String(value).trim().length > 0) {
        target.searchParams.set(key, String(value));
      }
    }
  }

  return target.toString();
}

export function buildLocalUrl(path: string, query?: Record<string, string | number | boolean | null | undefined>) {
  const target = new URL(path.startsWith("/") ? path : `/${path}`, "http://localhost");

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && String(value).trim().length > 0) {
        target.searchParams.set(key, String(value));
      }
    }
  }

  return `${target.pathname}${target.search}`;
}

async function apiFetch<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { query, headers, ...init } = options;
  const response = await fetch(buildApiUrl(path, query), {
    ...init,
    headers: {
      ...headers,
    },
    cache: init.cache ?? "no-store",
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string"
      ? payload.message
      : payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : "API request failed.";
    throw new Error(message);
  }

  return payload as T;
}

export function getProducts(page = 1, limit = PRODUCTS_FEED_PAGE_SIZE) {
  return apiFetch<ProductFeedPage>("/api/products", {
    query: { page, limit },
  });
}

export function getSearchProducts(query: string, page = 1, limit = PRODUCTS_FEED_PAGE_SIZE) {
  return apiFetch<ProductFeedPage>("/api/products/search", {
    query: { q: query, page, limit },
  });
}

export function getCategoryProducts(category: string, page = 1, limit = PRODUCTS_FEED_PAGE_SIZE) {
  return apiFetch<ProductFeedPage>("/api/products/category", {
    query: { category, page, limit },
  });
}

export function getFeaturedProducts(limit = 8, mode = "recommended") {
  return apiFetch<ProductFeedPage>("/api/products/featured", {
    query: { limit, mode },
  });
}

export function getProductBySlug(slug: string) {
  return apiFetch<{ product: CatalogProduct | null }>(`/api/products/${encodeURIComponent(slug)}`)
    .then((payload) => payload.product);
}

export function getRelatedProducts(slug: string, limit = 4) {
  return apiFetch<{ items: CatalogProduct[] }>(`/api/products/${encodeURIComponent(slug)}/related`, {
    query: { limit },
  }).then((payload) => payload.items);
}

export function getProductCategoryOptions() {
  return apiFetch<{ items: ProductFeedCategoryOption[] }>("/api/products/categories")
    .then((payload) => payload.items);
}

export function getProductCategoryBySlug(slug: string) {
  return apiFetch<{ category: ProductFeedCategorySummary | null }>(`/api/products/categories/${encodeURIComponent(slug)}`)
    .then((payload) => payload.category);
}

export function createOrder(body: Record<string, unknown>) {
  return apiFetch<{ order: ApiOrder }>("/api/orders", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

export function getOrderById(orderId: string) {
  return apiFetch<{ order: ApiOrder }>(`/api/orders/${encodeURIComponent(orderId)}`)
    .then((payload) => payload.order);
}

export function initializeMonerooPayment(orderId: string) {
  return apiFetch<{
    order: ApiOrder;
    paymentId?: string;
    checkoutUrl?: string;
    paymentStatus?: string;
  }>("/api/payments/init", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ orderId }),
  });
}

export function verifyMonerooPayment(orderId: string, paymentId: string) {
  return apiFetch<{
    order: ApiOrder;
    paymentId?: string;
    checkoutUrl?: string;
    paymentStatus?: string;
  }>("/api/payments/verify", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ orderId, paymentId }),
  });
}

export function applyOrderPromoCode(orderId: string, code: string) {
  return apiFetch<{
    order: ApiOrder;
    promoCode?: string;
    promoDiscountLabel?: string;
    originalTotal?: string;
    total?: string;
  }>(`/api/orders/${encodeURIComponent(orderId)}/promo`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ code }),
  });
}

export function previewPromoCode(code: string, totalFcfa: number) {
  return fetch(buildLocalUrl("/api/promo-codes/preview"), {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ code, totalFcfa }),
    cache: "no-store",
  })
    .then(async (response) => {
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.message || "Code promo invalide.");
      }

      return payload as {
        promoCode?: {
          code: string;
          label: string;
        };
        discountFcfa?: number;
        finalTotalFcfa?: number;
        message?: string;
      };
    });
}
