export type ProductTier = {
  quantityLabel: string;
  priceUsd: number;
  note?: string;
};

export type ProductVariantGroup = {
  label: string;
  values: string[];
};

export type ProductCatalogItem = {
  slug: string;
  title: string;
  shortTitle: string;
  keywords?: string[];
  image: string;
  gallery: string[];
  videoUrl?: string;
  videoPoster?: string;
  packaging: string;
  itemWeightGrams: number;
  lotCbm: string;
  minUsd: number;
  maxUsd?: number;
  moq: number;
  unit: string;
  badge?: string;
  supplierName: string;
  supplierLocation: string;
  responseTime: string;
  yearsInBusiness: number;
  transactionsLabel: string;
  soldLabel: string;
  customizationLabel: string;
  shippingLabel: string;
  overview: string[];
  variantGroups: ProductVariantGroup[];
  tiers: ProductTier[];
  specs: Array<{ label: string; value: string }>;
};
