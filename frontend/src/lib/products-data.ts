export type ProductTier = {
  quantityLabel: string;
  priceUsd: number;
  note?: string;
};

export type ProductVariantGroup = {
  label: string;
  values: string[];
};

export type ProductVariantPrice = {
  selections: Record<string, string>;
  priceUsd: number;
  minPriceUsd?: number;
  maxPriceUsd?: number;
  minimumQuantity?: number;
  maximumQuantity?: number;
  quantityLabel?: string;
  note?: string;
};

export type ProductVariantSku = {
  selections: Record<string, string>;
  skuId: string;
  skuCode?: string;
  inventory?: number;
  image?: string;
};

export type ProductPackageDimensions = {
  lengthCm: number;
  widthCm: number;
  heightCm: number;
};

export type ProductCatalogItem = {
  slug: string;
  title: string;
  shortTitle: string;
  description?: string;
  query?: string;
  keywords?: string[];
  categorySlug?: string;
  categoryTitle?: string;
  categoryPath?: string[];
  image: string;
  gallery: string[];
  videoUrl?: string;
  videoPoster?: string;
  packaging: string;
  packageDimensionsCm?: ProductPackageDimensions;
  itemWeightGrams: number;
  lotCbm: string;
  minUsd: number;
  maxUsd?: number;
  moq: number;
  moqVerified?: boolean;
  weightVerified?: boolean;
  priceVerified?: boolean;
  unit: string;
  badge?: string;
  supplierName: string;
  supplierCompanyId?: string;
  supplierLocation: string;
  responseTime: string;
  yearsInBusiness: number;
  transactionsLabel: string;
  soldLabel: string;
  customizationLabel: string;
  shippingLabel: string;
  chinaLocalFreightFcfa?: number;
  chinaLocalFreightLabel?: string;
  overview: string[];
  variantGroups: ProductVariantGroup[];
  variantPricing?: ProductVariantPrice[];
  variantSkus?: ProductVariantSku[];
  tiers: ProductTier[];
  specs: Array<{ label: string; value: string }>;
  sourceUrl?: string;
  reviewSummary?: {
    averageRating?: number | null;
    totalCount: number;
    customerCount?: number;
    externalCount?: number;
    customerAverageRating?: number | null;
    externalAverageRating?: number | null;
    withMediaCount?: number;
  };
  reviews?: Array<{
    id: string;
    source: "customer" | "aliexpress" | string;
    reviewerName: string;
    rating: number;
    title?: string | null;
    comment: string;
    mediaUrls: string[];
    verifiedPurchase: boolean;
    createdAt?: string | null;
    status?: string;
  }>;
  rawPayload?: unknown;
};
