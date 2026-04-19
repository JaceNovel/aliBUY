import { API_URL, buildApiUrl } from "@/lib/api";
import { getEffectiveProductMoq } from "@/lib/alibaba-sourcing";
import { getAlibabaImportedProducts } from "@/lib/alibaba-operations-store";
import { deriveVariantGroupsFromPricing, deriveVariantGroupsFromSkus, extractAlibabaVariantPricing, extractAlibabaVariantSkus } from "@/lib/product-variant-pricing";
import { resolveProductPriceSummaryUsd } from "@/lib/product-variant-pricing";
import { resolveCoherentItemWeightGrams, resolveCoherentPackageDimensionsCm } from "@/lib/product-weight";
import { type ProductCatalogItem } from "@/lib/products-data";

function normalizePackageDimensions(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const candidate = value as Record<string, unknown>;
  const lengthCm = typeof candidate.lengthCm === "number" && Number.isFinite(candidate.lengthCm) ? candidate.lengthCm : 0;
  const widthCm = typeof candidate.widthCm === "number" && Number.isFinite(candidate.widthCm) ? candidate.widthCm : 0;
  const heightCm = typeof candidate.heightCm === "number" && Number.isFinite(candidate.heightCm) ? candidate.heightCm : 0;

  if (lengthCm <= 0 || widthCm <= 0 || heightCm <= 0) {
    return undefined;
  }

  return {
    lengthCm,
    widthCm,
    heightCm,
  };
}

function calculateLotCbm(packageDimensionsCm: NonNullable<ProductCatalogItem["packageDimensionsCm"]>) {
  return ((packageDimensionsCm.lengthCm * packageDimensionsCm.widthCm * packageDimensionsCm.heightCm) / 1_000_000).toFixed(4);
}

function isPositiveLotCbm(value: string | undefined) {
  if (!value) {
    return false;
  }

  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0;
}

function normalizeMediaUrl(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }

  if (normalized.startsWith("//")) {
    return `https:${normalized}`;
  }

  return /^https?:\/\//i.test(normalized) || normalized.startsWith("/") ? normalized : undefined;
}

function collectRawMediaUrls(value: unknown, depth = 0): string[] {
  if (depth > 6 || value == null) {
    return [];
  }

  if (typeof value === "string") {
    const normalized = normalizeMediaUrl(value);
    return normalized && /\.(?:jpg|jpeg|png|webp)(?:[?_].*)?$/i.test(normalized) ? [normalized] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectRawMediaUrls(entry, depth + 1));
  }

  if (typeof value !== "object") {
    return [];
  }

  return Object.entries(value as Record<string, unknown>).flatMap(([key, nestedValue]) => {
    if (/(video|mp4|m3u8|webm)/i.test(key)) {
      return [];
    }

    if (/(image|img|photo|picture|gallery|poster|main_image|multi_image|url)/i.test(key) || depth < 2) {
      return collectRawMediaUrls(nestedValue, depth + 1);
    }

    return [];
  });
}

function buildRichGallery(input: { image?: string; gallery?: string[]; rawPayload?: unknown }) {
  const candidates = [
    ...(input.gallery ?? []),
    ...collectRawMediaUrls(input.rawPayload),
    input.image,
  ].flatMap((entry) => {
    const normalized = normalizeMediaUrl(entry);
    return normalized ? [normalized] : [];
  });

  return [...new Set(candidates)];
}

function normalizeCatalogTiers(value: unknown): ProductCatalogItem["tiers"] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return [] as ProductCatalogItem["tiers"];
    }

    const candidate = entry as Record<string, unknown>;
    const quantityLabel = typeof candidate.quantityLabel === "string" && candidate.quantityLabel.trim()
      ? candidate.quantityLabel.trim()
      : "";
    const priceUsd = typeof candidate.priceUsd === "number" && Number.isFinite(candidate.priceUsd) && candidate.priceUsd > 0
      ? candidate.priceUsd
      : 0;

    if (!quantityLabel || priceUsd <= 0) {
      return [] as ProductCatalogItem["tiers"];
    }

    return [{
      quantityLabel,
      priceUsd,
      ...(typeof candidate.note === "string" && candidate.note.trim() ? { note: candidate.note.trim() } : {}),
    }];
  });
}

function resolveCatalogMoq(moq: number, itemWeightGrams: number | undefined) {
  return getEffectiveProductMoq(moq, itemWeightGrams);
}

function resolveRemoteCatalogPricing(candidate: Record<string, unknown>, moq: number) {
  const rawPayload = candidate.rawPayload ?? candidate;
  const variantPricing: NonNullable<ProductCatalogItem["variantPricing"]> = Array.isArray(candidate.variantPricing)
    ? candidate.variantPricing as NonNullable<ProductCatalogItem["variantPricing"]>
    : extractAlibabaVariantPricing(rawPayload);
  const variantSkus: NonNullable<ProductCatalogItem["variantSkus"]> = Array.isArray(candidate.variantSkus)
    ? candidate.variantSkus as NonNullable<ProductCatalogItem["variantSkus"]>
    : extractAlibabaVariantSkus(rawPayload);
  const variantGroups = Array.isArray(candidate.variantGroups)
    ? candidate.variantGroups as ProductCatalogItem["variantGroups"]
    : [];
  const tiers = normalizeCatalogTiers(candidate.tiers);
  const derivedVariantGroupsFromPricing = deriveVariantGroupsFromPricing(variantPricing);
  const derivedVariantGroupsFromSkus = deriveVariantGroupsFromSkus(variantSkus);
  const providedMinUsd = typeof candidate.minUsd === "number" && Number.isFinite(candidate.minUsd) && candidate.minUsd > 0
    ? candidate.minUsd
    : undefined;
  const providedMaxUsd = typeof candidate.maxUsd === "number" && Number.isFinite(candidate.maxUsd) && candidate.maxUsd > 0
    ? candidate.maxUsd
    : undefined;
  const summary = resolveProductPriceSummaryUsd({
    tiers,
    variantPricing,
    minUsd: providedMinUsd,
    maxUsd: providedMaxUsd,
    moq,
  }, {
    quantity: Math.max(1, moq),
  });
  const minUsd = summary.minUsd > 0 ? summary.minUsd : providedMinUsd ?? 0;
  const maxUsd = typeof summary.maxUsd === "number" && summary.maxUsd > minUsd
    ? summary.maxUsd
    : (typeof providedMaxUsd === "number" && providedMaxUsd > minUsd ? providedMaxUsd : undefined);

  return {
    minUsd,
    maxUsd,
    tiers: tiers.length > 0
      ? tiers
      : (minUsd > 0 ? [{ quantityLabel: `${Math.max(1, moq)}+`, priceUsd: minUsd }] : []),
    variantPricing,
    variantSkus,
    variantGroups: variantGroups.length > 0
      ? variantGroups
      : (derivedVariantGroupsFromPricing.length > 0
        ? derivedVariantGroupsFromPricing
        : derivedVariantGroupsFromSkus),
  };
}

async function fetchRemoteCatalogProducts() {
  if (!API_URL) {
    return null;
  }

  try {
    const items: ProductCatalogItem[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await fetch(buildApiUrl("/api/catalog/products", { page, limit: 40 }), {
        cache: "no-store",
      });

      if (!response.ok) {
        return items.length > 0 ? items : null;
      }

      const payload = await response.json().catch(() => null) as { items?: unknown[]; hasMore?: boolean; nextPage?: number | null } | null;
      if (!Array.isArray(payload?.items)) {
        return items.length > 0 ? items : null;
      }

      const pageItems = payload.items.flatMap((item) => {
      if (!item || typeof item !== "object") {
        return [] as ProductCatalogItem[];
      }

      const candidate = item as Record<string, unknown>;
      const slug = typeof candidate.slug === "string" && candidate.slug.trim() ? candidate.slug.trim() : "";
      const title = typeof candidate.title === "string" && candidate.title.trim() ? candidate.title.trim() : slug;
      const image = typeof candidate.image === "string" ? candidate.image.trim() : "";
      if (!slug || !title || !image) {
        return [] as ProductCatalogItem[];
      }

      const moq = typeof candidate.moq === "number" && Number.isFinite(candidate.moq) && candidate.moq > 0 ? candidate.moq : 1;
      const unit = typeof candidate.unit === "string" && candidate.unit.trim() ? candidate.unit.trim() : "piece";
      const pricing = resolveRemoteCatalogPricing(candidate, moq);
      const shortTitle = typeof candidate.shortTitle === "string" && candidate.shortTitle.trim() ? candidate.shortTitle.trim() : title;
      const query = typeof candidate.query === "string" && candidate.query.trim() ? candidate.query.trim() : undefined;
      const keywords = Array.isArray(candidate.keywords)
        ? candidate.keywords.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
        : [];
      const categorySlug = typeof candidate.categorySlug === "string" && candidate.categorySlug.trim() ? candidate.categorySlug.trim() : undefined;
      const categoryTitle = typeof candidate.categoryTitle === "string" && candidate.categoryTitle.trim() ? candidate.categoryTitle.trim() : undefined;
      const categoryPath = Array.isArray(candidate.categoryPath)
        ? candidate.categoryPath.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
        : undefined;
      const specs = Array.isArray(candidate.specs) ? candidate.specs as ProductCatalogItem["specs"] : [];
      const packaging = typeof candidate.packaging === "string" && candidate.packaging.trim() ? candidate.packaging.trim() : "Selon catalogue";
      const rawLotCbm = typeof candidate.lotCbm === "string" && candidate.lotCbm.trim() ? candidate.lotCbm.trim() : undefined;
      const rawPackageDimensionsCm = normalizePackageDimensions(candidate.packageDimensionsCm);
      const weightContext = {
        title,
        shortTitle,
        query,
        keywords,
        categorySlug,
        categoryTitle,
        categoryPath,
        packaging,
        unit,
        specs: specs.map((spec) => `${spec.label} ${spec.value}`),
        lotCbm: rawLotCbm,
        moq,
      };
      const packageDimensionsCm = resolveCoherentPackageDimensionsCm(rawPackageDimensionsCm, weightContext);
      const rawWeightGrams = typeof candidate.itemWeightGrams === "number" && Number.isFinite(candidate.itemWeightGrams) ? candidate.itemWeightGrams : undefined;
      const itemWeightGrams = resolveCoherentItemWeightGrams(rawWeightGrams, weightContext);
      const lotCbm = rawLotCbm && isPositiveLotCbm(rawLotCbm) ? rawLotCbm : calculateLotCbm(packageDimensionsCm);
      const effectiveMoq = resolveCatalogMoq(moq, itemWeightGrams);

      const gallery = buildRichGallery({
        image,
        gallery: Array.isArray(candidate.gallery)
          ? candidate.gallery.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
          : [],
        rawPayload: candidate.rawPayload ?? candidate,
      });

      return [{
        slug,
        title,
        shortTitle,
        description: typeof candidate.description === "string" && candidate.description.trim() ? candidate.description.trim() : undefined,
        query,
        keywords,
        categorySlug,
        categoryTitle,
        categoryPath,
        image,
        gallery: gallery.length > 0 ? gallery : [image],
        videoUrl: typeof candidate.videoUrl === "string" && candidate.videoUrl.trim() ? candidate.videoUrl.trim() : undefined,
        videoPoster: typeof candidate.videoPoster === "string" && candidate.videoPoster.trim() ? candidate.videoPoster.trim() : undefined,
        packaging,
        packageDimensionsCm,
        itemWeightGrams,
        lotCbm,
        minUsd: pricing.minUsd,
        maxUsd: pricing.maxUsd,
        moq: effectiveMoq,
        moqVerified: typeof candidate.moqVerified === "boolean" ? candidate.moqVerified : false,
        weightVerified: typeof candidate.weightVerified === "boolean" ? candidate.weightVerified : false,
        priceVerified: typeof candidate.priceVerified === "boolean" ? candidate.priceVerified : true,
        unit,
        badge: typeof candidate.badge === "string" && candidate.badge.trim() ? candidate.badge.trim() : undefined,
        supplierName: typeof candidate.supplierName === "string" && candidate.supplierName.trim() ? candidate.supplierName.trim() : "Selection AfriPay+",
        supplierCompanyId: typeof candidate.supplierCompanyId === "string" && candidate.supplierCompanyId.trim() ? candidate.supplierCompanyId.trim() : undefined,
        supplierLocation: typeof candidate.supplierLocation === "string" && candidate.supplierLocation.trim() ? candidate.supplierLocation.trim() : "CN",
        responseTime: typeof candidate.responseTime === "string" && candidate.responseTime.trim() ? candidate.responseTime.trim() : "Sous 24 h",
        yearsInBusiness: typeof candidate.yearsInBusiness === "number" && Number.isFinite(candidate.yearsInBusiness) ? candidate.yearsInBusiness : 1,
        transactionsLabel: typeof candidate.transactionsLabel === "string" && candidate.transactionsLabel.trim() ? candidate.transactionsLabel.trim() : "Catalogue live",
        soldLabel: typeof candidate.soldLabel === "string" && candidate.soldLabel.trim() ? candidate.soldLabel.trim() : "0",
        customizationLabel: typeof candidate.customizationLabel === "string" && candidate.customizationLabel.trim() ? candidate.customizationLabel.trim() : "Selon catalogue",
        shippingLabel: typeof candidate.shippingLabel === "string" && candidate.shippingLabel.trim() ? candidate.shippingLabel.trim() : "Livraison internationale",
        chinaLocalFreightFcfa: typeof candidate.chinaLocalFreightFcfa === "number" && Number.isFinite(candidate.chinaLocalFreightFcfa) ? candidate.chinaLocalFreightFcfa : undefined,
        chinaLocalFreightLabel: typeof candidate.chinaLocalFreightLabel === "string" && candidate.chinaLocalFreightLabel.trim() ? candidate.chinaLocalFreightLabel.trim() : undefined,
        overview: Array.isArray(candidate.overview)
          ? candidate.overview.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
          : [title],
        variantGroups: pricing.variantGroups,
        variantPricing: pricing.variantPricing,
        variantSkus: pricing.variantSkus,
        tiers: pricing.tiers,
        specs,
        rawPayload: candidate.rawPayload ?? candidate,
      } satisfies ProductCatalogItem];
    });

      items.push(...pageItems);
      hasMore = Boolean(payload?.hasMore) && page < 50;
      page = typeof payload?.nextPage === 'number' && Number.isFinite(payload.nextPage)
        ? payload.nextPage
        : page + 1;
    }

    return items;
  } catch {
    return null;
  }
}

async function fetchRemoteCatalogProductDetail(slug: string) {
  if (!API_URL) {
    return null;
  }

  try {
    const response = await fetch(buildApiUrl(`/api/products/${encodeURIComponent(slug)}`), {
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json().catch(() => null) as { product?: Record<string, unknown> | null } | null;
    const candidate = payload?.product;
    if (!candidate || typeof candidate !== "object") {
      return null;
    }

    const image = typeof candidate.image === "string" && candidate.image.trim() ? candidate.image.trim() : "";
    if (!image) {
      return null;
    }

    const title = typeof candidate.title === "string" && candidate.title.trim() ? candidate.title.trim() : slug;
    const shortTitle = typeof candidate.shortTitle === "string" && candidate.shortTitle.trim() ? candidate.shortTitle.trim() : title;
    const query = typeof candidate.query === "string" && candidate.query.trim() ? candidate.query.trim() : undefined;
    const keywords = Array.isArray(candidate.keywords)
      ? candidate.keywords.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
      : [];
    const categorySlug = typeof candidate.categorySlug === "string" && candidate.categorySlug.trim() ? candidate.categorySlug.trim() : undefined;
    const categoryTitle = typeof candidate.categoryTitle === "string" && candidate.categoryTitle.trim() ? candidate.categoryTitle.trim() : undefined;
    const categoryPath = Array.isArray(candidate.categoryPath)
      ? candidate.categoryPath.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
      : undefined;
    const specs = Array.isArray(candidate.specs) ? candidate.specs as ProductCatalogItem["specs"] : [];
    const packaging = typeof candidate.packaging === "string" && candidate.packaging.trim() ? candidate.packaging.trim() : "Selon catalogue";
    const unit = typeof candidate.unit === "string" && candidate.unit.trim() ? candidate.unit.trim() : "piece";
    const moq = typeof candidate.moq === "number" && Number.isFinite(candidate.moq) && candidate.moq > 0 ? candidate.moq : 1;
    const rawLotCbm = typeof candidate.lotCbm === "string" && candidate.lotCbm.trim() ? candidate.lotCbm.trim() : undefined;
    const rawPackageDimensionsCm = normalizePackageDimensions(candidate.packageDimensionsCm);
    const weightContext = {
      title,
      shortTitle,
      query,
      keywords,
      categorySlug,
      categoryTitle,
      categoryPath,
      packaging,
      unit,
      specs: specs.map((spec) => `${spec.label} ${spec.value}`),
      lotCbm: rawLotCbm,
      moq,
    };
    const packageDimensionsCm = resolveCoherentPackageDimensionsCm(rawPackageDimensionsCm, weightContext);
    const rawWeightGrams = typeof candidate.itemWeightGrams === "number" && Number.isFinite(candidate.itemWeightGrams) ? candidate.itemWeightGrams : undefined;
    const itemWeightGrams = resolveCoherentItemWeightGrams(rawWeightGrams, weightContext);
    const lotCbm = rawLotCbm && isPositiveLotCbm(rawLotCbm) ? rawLotCbm : calculateLotCbm(packageDimensionsCm);
    const effectiveMoq = resolveCatalogMoq(moq, itemWeightGrams);

    const gallery = buildRichGallery({
      image,
      gallery: Array.isArray(candidate.gallery)
        ? candidate.gallery.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
        : [],
      rawPayload: candidate.rawPayload ?? candidate,
    });

    const pricing = resolveRemoteCatalogPricing(candidate, moq);

    return {
      slug,
      title,
      shortTitle,
      description: typeof candidate.description === "string" && candidate.description.trim() ? candidate.description.trim() : undefined,
      image,
      gallery: gallery.length > 0 ? gallery : [image],
      videoUrl: typeof candidate.videoUrl === "string" && candidate.videoUrl.trim() ? candidate.videoUrl.trim() : undefined,
      videoPoster: typeof candidate.videoPoster === "string" && candidate.videoPoster.trim() ? candidate.videoPoster.trim() : undefined,
      badge: typeof candidate.badge === "string" && candidate.badge.trim() ? candidate.badge.trim() : undefined,
      minUsd: pricing.minUsd,
      maxUsd: pricing.maxUsd,
      moq: effectiveMoq,
      moqVerified: typeof candidate.moqVerified === "boolean" ? candidate.moqVerified : false,
      weightVerified: typeof candidate.weightVerified === "boolean" ? candidate.weightVerified : undefined,
      priceVerified: typeof candidate.priceVerified === "boolean" ? candidate.priceVerified : undefined,
      unit,
      packaging,
      packageDimensionsCm,
      itemWeightGrams,
      lotCbm,
      supplierName: typeof candidate.supplierName === "string" && candidate.supplierName.trim() ? candidate.supplierName.trim() : "Selection AfriPay+",
      supplierLocation: typeof candidate.supplierLocation === "string" && candidate.supplierLocation.trim() ? candidate.supplierLocation.trim() : "CN",
      responseTime: typeof candidate.responseTime === "string" && candidate.responseTime.trim() ? candidate.responseTime.trim() : "Sous 24 h",
      yearsInBusiness: typeof candidate.yearsInBusiness === "number" && Number.isFinite(candidate.yearsInBusiness) ? candidate.yearsInBusiness : 1,
      transactionsLabel: typeof candidate.transactionsLabel === "string" && candidate.transactionsLabel.trim() ? candidate.transactionsLabel.trim() : "Catalogue live",
      soldLabel: typeof candidate.soldLabel === "string" && candidate.soldLabel.trim() ? candidate.soldLabel.trim() : "0",
      customizationLabel: typeof candidate.customizationLabel === "string" && candidate.customizationLabel.trim() ? candidate.customizationLabel.trim() : "Selon catalogue",
      shippingLabel: typeof candidate.shippingLabel === "string" && candidate.shippingLabel.trim() ? candidate.shippingLabel.trim() : "Livraison internationale",
      overview: Array.isArray(candidate.overview)
        ? candidate.overview.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
        : [],
      variantGroups: pricing.variantGroups,
      variantPricing: pricing.variantPricing,
      variantSkus: pricing.variantSkus,
      tiers: pricing.tiers,
      specs,
      keywords,
      sourceUrl: typeof candidate.sourceUrl === "string" && candidate.sourceUrl.trim() ? candidate.sourceUrl.trim() : undefined,
      reviewSummary: candidate.reviewSummary && typeof candidate.reviewSummary === "object" ? candidate.reviewSummary as ProductCatalogItem["reviewSummary"] : undefined,
      reviews: Array.isArray(candidate.reviews) ? candidate.reviews as ProductCatalogItem["reviews"] : undefined,
      rawPayload: candidate.rawPayload ?? candidate,
    } satisfies ProductCatalogItem;
  } catch {
    return null;
  }
}

function toCatalogProduct(product: Awaited<ReturnType<typeof getAlibabaImportedProducts>>[number]): ProductCatalogItem {
  const variantPricing = product.variantPricing && product.variantPricing.length > 0
    ? product.variantPricing
    : extractAlibabaVariantPricing(product.rawPayload);
  const variantSkus = product.variantSkus && product.variantSkus.length > 0
    ? product.variantSkus
    : extractAlibabaVariantSkus(product.rawPayload);
  const fallbackVariantGroups = deriveVariantGroupsFromPricing(variantPricing);
  const fallbackVariantGroupsFromSkus = deriveVariantGroupsFromSkus(variantSkus);
  const variantGroups = product.variantGroups.length > 0
    ? product.variantGroups
    : fallbackVariantGroups.length > 0
      ? fallbackVariantGroups
      : fallbackVariantGroupsFromSkus;
  const lotCbm = isPositiveLotCbm(product.lotCbm)
    ? product.lotCbm
    : product.packageDimensionsCm
      ? calculateLotCbm(product.packageDimensionsCm)
      : product.lotCbm;
  const effectiveMoq = resolveCatalogMoq(product.moq, product.itemWeightGrams);

  return {
    slug: product.slug,
    title: product.title,
    shortTitle: product.shortTitle,
    description: product.description,
    query: product.query,
    keywords: product.keywords,
    categorySlug: product.categorySlug,
    categoryTitle: product.categoryTitle,
    categoryPath: product.categoryPath,
    image: product.image,
    gallery: buildRichGallery({
      image: product.image,
      gallery: product.gallery,
      rawPayload: product.rawPayload,
    }),
    videoUrl: product.videoUrl,
    videoPoster: product.videoPoster,
    packaging: product.packaging,
    packageDimensionsCm: product.packageDimensionsCm,
    itemWeightGrams: product.itemWeightGrams,
    lotCbm,
    minUsd: product.minUsd,
    maxUsd: product.maxUsd,
    moq: effectiveMoq,
    moqVerified: product.moqVerified,
    unit: product.unit,
    badge: product.badge,
    supplierName: product.supplierName,
    supplierLocation: product.supplierLocation,
    responseTime: product.responseTime,
    yearsInBusiness: product.yearsInBusiness,
    transactionsLabel: product.transactionsLabel,
    soldLabel: product.soldLabel,
    customizationLabel: product.customizationLabel,
    shippingLabel: product.shippingLabel,
    chinaLocalFreightFcfa: product.chinaLocalFreightFcfa,
    chinaLocalFreightLabel: product.chinaLocalFreightLabel,
    overview: product.overview,
    variantGroups,
    variantPricing,
    variantSkus,
    tiers: product.tiers,
    specs: product.specs,
    rawPayload: product.rawPayload,
  };
}

function mergeCatalogProducts(remoteProducts: ProductCatalogItem[], localProducts: ProductCatalogItem[]) {
  const merged = new Map<string, ProductCatalogItem>();
  const localBySlug = new Map(localProducts.map((product) => [product.slug, product]));

  for (const product of remoteProducts) {
    const local = localBySlug.get(product.slug);
    if (!local) {
      merged.set(product.slug, product);
      continue;
    }

    const remoteHasPackageDimensions = Boolean(
      product.packageDimensionsCm
      && product.packageDimensionsCm.lengthCm > 0
      && product.packageDimensionsCm.widthCm > 0
      && product.packageDimensionsCm.heightCm > 0,
    );
    const localHasPackageDimensions = Boolean(
      local.packageDimensionsCm
      && local.packageDimensionsCm.lengthCm > 0
      && local.packageDimensionsCm.widthCm > 0
      && local.packageDimensionsCm.heightCm > 0,
    );

    const remoteGallery = product.gallery && product.gallery.length > 0 ? product.gallery : [];
    const localGallery = local.gallery && local.gallery.length > 0 ? local.gallery : [];
    const richestGallery = localGallery.length > remoteGallery.length ? localGallery : remoteGallery.length > 0 ? remoteGallery : localGallery;

    const mergedWeightGrams = product.itemWeightGrams > 0 ? product.itemWeightGrams : local.itemWeightGrams;
    const mergedMoq = resolveCatalogMoq(Math.max(product.moq, local.moq), mergedWeightGrams);

    merged.set(product.slug, {
      ...product,
      query: product.query ?? local.query,
      keywords: product.keywords && product.keywords.length > 0 ? product.keywords : local.keywords,
      categorySlug: product.categorySlug ?? local.categorySlug,
      categoryTitle: product.categoryTitle ?? local.categoryTitle,
      categoryPath: product.categoryPath && product.categoryPath.length > 0 ? product.categoryPath : local.categoryPath,
      gallery: richestGallery,
      videoUrl: product.videoUrl ?? local.videoUrl,
      videoPoster: product.videoPoster ?? local.videoPoster,
      packaging: product.packaging !== "Selon catalogue" ? product.packaging : local.packaging,
      packageDimensionsCm: remoteHasPackageDimensions ? product.packageDimensionsCm : localHasPackageDimensions ? local.packageDimensionsCm : product.packageDimensionsCm,
      itemWeightGrams: mergedWeightGrams,
      lotCbm: product.lotCbm && product.lotCbm !== "0" && product.lotCbm !== "0.0000" ? product.lotCbm : local.lotCbm,
      moq: mergedMoq,
      moqVerified: product.moqVerified ?? local.moqVerified,
      weightVerified: product.weightVerified ?? local.weightVerified,
      priceVerified: product.priceVerified ?? local.priceVerified,
      supplierCompanyId: product.supplierCompanyId ?? local.supplierCompanyId,
      chinaLocalFreightFcfa: product.chinaLocalFreightFcfa ?? local.chinaLocalFreightFcfa,
      chinaLocalFreightLabel: product.chinaLocalFreightLabel ?? local.chinaLocalFreightLabel,
      description: product.description && product.description.trim().length > 0 ? product.description : local.description,
      overview: product.overview && product.overview.length > 0 ? product.overview : local.overview,
      variantGroups: product.variantGroups && product.variantGroups.length > 0 ? product.variantGroups : local.variantGroups,
      variantPricing: product.variantPricing && product.variantPricing.length > 0 ? product.variantPricing : local.variantPricing,
      variantSkus: product.variantSkus && product.variantSkus.length > 0 ? product.variantSkus : local.variantSkus,
      tiers: product.tiers && product.tiers.length > 0 ? product.tiers : local.tiers,
      specs: product.specs && product.specs.length > 0 ? product.specs : local.specs,
      rawPayload: product.rawPayload ?? local.rawPayload,
    });
  }

  for (const product of localProducts) {
    if (!merged.has(product.slug)) {
      merged.set(product.slug, product);
    }
  }

  return [...merged.values()];
}

async function readCatalogProductsSource(): Promise<ProductCatalogItem[]> {
  const remoteProducts = await fetchRemoteCatalogProducts();
  const importedProducts = await getAlibabaImportedProducts();
  const localProducts = importedProducts
    .filter((product) => product.publishedToSite && product.status !== "archived")
    .sort((left, right) => (right.publishedAt ?? right.updatedAt).localeCompare(left.publishedAt ?? left.updatedAt))
    .map((product) => toCatalogProduct(product));

  if (remoteProducts && remoteProducts.length > 0) {
    return mergeCatalogProducts(remoteProducts, localProducts);
  }

  return localProducts;
}

export async function getCatalogProducts(options?: { fresh?: boolean }): Promise<ProductCatalogItem[]> {
  if (options?.fresh) {
    return readCatalogProductsSource();
  }

  return readCatalogProductsSource();
}

export async function getCatalogProductBySlug(slug: string) {
  const remoteDetail = await fetchRemoteCatalogProductDetail(slug);
  if (remoteDetail) {
    const catalogProducts = await readCatalogProductsSource();
    const catalogProduct = catalogProducts.find((product) => product.slug === slug);

    if (catalogProduct) {
      return mergeCatalogProducts([remoteDetail], [catalogProduct])[0] ?? remoteDetail;
    }

    return remoteDetail;
  }

  const products = await getCatalogProducts();
  const product = products.find((entry) => entry.slug === slug) ?? null;
  if (!product) {
    return null;
  }

  const needsAttributeRecovery = product.variantGroups.length === 0 && (product.variantSkus?.length ?? 0) === 0;

  const hasDimensions = Boolean(
    product.packageDimensionsCm
    && product.packageDimensionsCm.lengthCm > 0
    && product.packageDimensionsCm.widthCm > 0
    && product.packageDimensionsCm.heightCm > 0,
  );
  const hasWeight = product.itemWeightGrams > 0;
  if (hasDimensions && hasWeight && !needsAttributeRecovery) {
    return product;
  }

  const importedProducts = await getAlibabaImportedProducts({ fresh: true });
  const importedProduct = importedProducts.find((entry) => entry.slug === slug && entry.publishedToSite && entry.status !== "archived");
  if (!importedProduct) {
    return product;
  }

  try {
    const { reenrichImportedProduct } = await import("@/lib/alibaba-operations-service");
    const reenrichedProduct = await reenrichImportedProduct(importedProduct.id);
    const normalizedReenrichedProduct = toCatalogProduct(reenrichedProduct);
    return mergeCatalogProducts([normalizedReenrichedProduct], [product])[0] ?? normalizedReenrichedProduct;
  } catch {
    return product;
  }
}

export async function getCatalogProductsBySlugs(slugs: string[], options?: { fresh?: boolean }) {
  const products = await getCatalogProducts(options);
  const map = new Map(products.map((product) => [product.slug, product]));
  return slugs.flatMap((slug) => {
    const product = map.get(slug);
    return product ? [product] : [];
  });
}

export async function getCatalogRelatedProducts(currentSlug: string, limit = 4) {
  const products = await getCatalogProducts();
  return products.filter((product) => product.slug !== currentSlug).slice(0, limit);
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenizeSearchText(value: string) {
  const tokens = normalizeSearchText(value).split(/\s+/).filter((token) => token.length >= 2);
  const synonyms: Record<string, string[]> = {
    chaussure: ["shoe", "shoes", "sneaker", "sneakers", "footwear"],
    chaussures: ["shoe", "shoes", "sneaker", "sneakers", "footwear"],
    sac: ["bag", "bags", "backpack", "handbag", "wallet", "purse"],
    sacs: ["bag", "bags", "backpack", "handbag", "wallet", "purse"],
    telephone: ["phone", "phones", "smartphone", "mobile"],
    telephones: ["phone", "phones", "smartphone", "mobile"],
    accessoires: ["accessory", "accessories", "case", "cover", "charger", "usb"],
    montre: ["watch", "watches"],
    montres: ["watch", "watches"],
    bijou: ["jewelry", "jewellery", "ring", "necklace", "bracelet"],
    bijoux: ["jewelry", "jewellery", "ring", "necklace", "bracelet"],
  };

  return [...new Set(tokens.flatMap((token) => [token, ...(synonyms[token] ?? [])]))];
}

function collectProductSearchFields(product: ProductCatalogItem) {
  return [
    product.title,
    product.shortTitle,
    product.description ?? "",
    product.slug,
    product.query ?? "",
    product.supplierName,
    product.supplierCompanyId ?? "",
    product.supplierLocation,
    product.categorySlug ?? "",
    product.categoryTitle ?? "",
    ...(product.categoryPath ?? []),
    ...(product.keywords ?? []),
    ...product.overview,
    product.badge ?? "",
    ...product.specs.map((spec) => `${spec.label} ${spec.value}`),
    ...product.variantGroups.flatMap((group) => [group.label, ...group.values]),
    ...(product.variantSkus ?? []).flatMap((sku) => [
      sku.skuId,
      sku.skuCode ?? "",
      ...Object.entries(sku.selections).flatMap(([label, value]) => [label, value]),
    ]),
  ].map((entry) => normalizeSearchText(entry)).filter(Boolean);
}

function getSearchWords(fields: string[]) {
  return [...new Set(fields.flatMap((field) => field.split(/\s+/)).filter((word) => word.length >= 3))];
}

function isCloseSearchWord(token: string, word: string) {
  if (word.includes(token) || token.includes(word)) {
    return true;
  }

  if (token.length < 4 || word.length < 4) {
    return false;
  }

  const prefixLength = Math.min(token.length, word.length, 4);
  if (token.slice(0, prefixLength) === word.slice(0, prefixLength)) {
    return true;
  }

  const distance = levenshteinDistance(token, word, token.length <= 5 ? 1 : 2);
  return distance >= 0 && distance <= (token.length <= 5 ? 1 : 2);
}

function levenshteinDistance(left: string, right: string, maxDistance: number) {
  if (Math.abs(left.length - right.length) > maxDistance) {
    return -1;
  }

  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    let rowMinimum = current[0];

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      const value = Math.min(
        previous[rightIndex] + 1,
        current[rightIndex - 1] + 1,
        previous[rightIndex - 1] + substitutionCost,
      );
      current[rightIndex] = value;
      rowMinimum = Math.min(rowMinimum, value);
    }

    if (rowMinimum > maxDistance) {
      return -1;
    }

    previous = current;
  }

  return previous[right.length] ?? -1;
}

function scoreCatalogProduct(
  product: ProductCatalogItem,
  normalizedQuery: string,
  queryTokens: string[],
  mode: "exact" | "similar",
) {
  const title = normalizeSearchText(product.title);
  const shortTitle = normalizeSearchText(product.shortTitle);
  const keywords = (product.keywords ?? []).map((keyword) => normalizeSearchText(keyword)).filter(Boolean);
  const supplier = normalizeSearchText([product.supplierName, product.supplierCompanyId ?? "", product.supplierLocation].join(" "));
  const category = normalizeSearchText([product.categorySlug ?? "", product.categoryTitle ?? "", ...(product.categoryPath ?? [])].join(" "));
  const specs = normalizeSearchText(product.specs.map((spec) => `${spec.label} ${spec.value}`).join(" "));
  const variants = normalizeSearchText(product.variantGroups.flatMap((group) => [group.label, ...group.values]).join(" "));
  const allFields = collectProductSearchFields(product);
  const allWords = getSearchWords(allFields);
  const haystacks = [title, shortTitle, ...keywords, supplier, category, specs, variants, ...allFields].filter(Boolean);

  let score = 0;
  let directMatch = false;
  let matchedTokens = 0;

  if (title === normalizedQuery) {
    score += 220;
    directMatch = true;
  }

  if (shortTitle === normalizedQuery) {
    score += 200;
    directMatch = true;
  }

  if (title.includes(normalizedQuery)) {
    score += 120;
    directMatch = true;
  }

  if (shortTitle.includes(normalizedQuery)) {
    score += 90;
    directMatch = true;
  }

  if (keywords.some((keyword) => keyword.includes(normalizedQuery))) {
    score += 70;
    directMatch = true;
  }

  if (supplier.includes(normalizedQuery)) {
    score += 80;
    directMatch = true;
  }

  if (category.includes(normalizedQuery)) {
    score += 75;
    directMatch = true;
  }

  if (haystacks.some((entry) => entry.includes(normalizedQuery))) {
    score += 55;
    directMatch = true;
  }

  for (const token of queryTokens) {
    let tokenScore = 0;

    if (title.includes(token)) {
      tokenScore = 24;
    } else if (shortTitle.includes(token)) {
      tokenScore = 18;
    } else if (keywords.some((keyword) => keyword.includes(token))) {
      tokenScore = 14;
    } else if (supplier.includes(token)) {
      tokenScore = 14;
    } else if (category.includes(token)) {
      tokenScore = 14;
    } else if (specs.includes(token) || variants.includes(token)) {
      tokenScore = 12;
    } else if (haystacks.some((entry) => entry.includes(token))) {
      tokenScore = 10;
    } else if (mode === "similar" && allWords.some((word) => isCloseSearchWord(token, word))) {
      tokenScore = 8;
    }

    if (tokenScore > 0) {
      matchedTokens += 1;
      score += tokenScore;
    }
  }

  if (queryTokens.length > 0 && matchedTokens === queryTokens.length) {
    score += mode === "exact" ? 50 : 20;
    directMatch = true;
  }

  if (mode === "exact") {
    if (!directMatch && matchedTokens < Math.max(1, queryTokens.length)) {
      return 0;
    }
  } else if (matchedTokens === 0 && score < 40) {
    return 0;
  }

  return score;
}

async function findCatalogProductsByMode(query: string, mode: "exact" | "similar", limit?: number) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return [];
  }

  const queryTokens = tokenizeSearchText(query);
  const ranked = (await getCatalogProducts())
    .map((product) => ({
      product,
      score: scoreCatalogProduct(product, normalizedQuery, queryTokens, mode),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.product.title.localeCompare(right.product.title));

  const products = ranked.map((entry) => entry.product);
  return typeof limit === "number" ? products.slice(0, limit) : products;
}

export async function searchCatalogProducts(query: string, limit?: number) {
  return findCatalogProductsByMode(query, "exact", limit);
}

export async function findSimilarCatalogProducts(query: string, limit?: number) {
  return findCatalogProductsByMode(query, "similar", limit);
}
