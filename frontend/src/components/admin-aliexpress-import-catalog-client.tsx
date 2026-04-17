"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, ExternalLink, LoaderCircle, Package2, RefreshCcw, Search, ShoppingBag, Sparkles, Trash2, WandSparkles, Warehouse } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type {
  AlibabaCountryProfile,
  AlibabaImportCampaignMode,
  AlibabaImportJob,
  AlibabaImportedProduct,
  AlibabaPanelSlug,
  AlibabaPurchaseOrder,
  AlibabaReceptionAddress,
  AlibabaReceptionRecord,
  AlibabaSupplierAccount,
} from "@/lib/alibaba-operations";
import { buildApiUrl } from "@/lib/api";
import { formatTierAwarePrice, formatTierAwarePriceMeta } from "@/lib/product-price-display";

type DashboardData = {
  panel: AlibabaPanelSlug;
  importJobs: AlibabaImportJob[];
  importedProducts: AlibabaImportedProduct[];
  purchaseOrders: AlibabaPurchaseOrder[];
  supplierAccounts: AlibabaSupplierAccount[];
  countries: AlibabaCountryProfile[];
  addresses: AlibabaReceptionAddress[];
  receptions: AlibabaReceptionRecord[];
  storage: {
    persistentAvailable: boolean;
    persistentRequired: boolean;
    issue: string | null;
  };
  stats: {
    importedCount: number;
    publishedCount: number;
    pendingPayments: number;
    paidOrders: number;
  };
};

type SearchExtendRow = {
  id: string;
  searchKey: string;
  searchValue: string;
  min: string;
  max: string;
};

type SearchPreviewProduct = {
  sourceProductId: string;
  shortTitle: string;
  title: string;
  image: string;
  minUsd: number;
  maxUsd?: number;
  supplierName: string;
  supplierLocation: string;
  inventory: number;
  moq: number;
  unit: string;
  variantGroups: Array<{ label: string; values: string[] }>;
  videoUrl?: string;
};

type SearchPreviewItem = {
  productId: string;
  title: string;
  itemUrl?: string;
  imageUrl?: string;
  videoUrl?: string;
  salePrice?: string;
  salePriceFormat?: string;
  salePriceCurrency?: string;
  originalPrice?: string;
  originalPriceFormat?: string;
  originalPriceCurrency?: string;
  targetSalePrice?: string;
  targetOriginalPrice?: string;
  targetOriginalPriceCurrency?: string;
  discount?: string;
  orders?: string;
  score?: string;
  evaluateRate?: string;
  categoryId?: string;
  importable: boolean;
  importSource?: "detail" | "search_fallback";
  importReason?: string;
  product?: SearchPreviewProduct;
};

type SearchResponse = {
  products: SearchPreviewItem[];
  totalCount: number;
  pageIndex: number;
  pageSize: number;
  requestId?: string;
};

const IMPORT_CAMPAIGN_OPTIONS: Array<{ value: AlibabaImportCampaignMode; label: string; description: string }> = [
  { value: "standard", label: "Catalogue standard", description: "Import classique sans routage storefront prioritaire." },
  { value: "trends-promo", label: "Tendances promo", description: "Force la mise en avant promotionnelle sur la page Tendances." },
  { value: "trends-hot", label: "Tendances hot", description: "Pousse les fiches vedettes sur la grille Tendances." },
  { value: "mode-fashion", label: "Mode", description: "Reserve l'import pour la page Mode et ses selections." },
  { value: "free-deal", label: "Articles gratuits", description: "Publie la selection et alimente automatiquement la campagne Articles gratuits." },
];

const FULFILLMENT_OPTIONS = [
  { value: "crossborder", label: "Crossborder" },
  { value: "standard_us", label: "Standard US" },
  { value: "fast_us", label: "Fast US 48h" },
  { value: "mexico", label: "Mexique" },
  { value: "best_seller_us", label: "Best seller US" },
  { value: "best_seller_mexico", label: "Best seller Mexique" },
];

const LANGUAGE_OPTIONS = [
  { value: "fr_FR", label: "Francais" },
  { value: "en_US", label: "English US" },
  { value: "en_GB", label: "English UK" },
  { value: "es_ES", label: "Espanol" },
  { value: "pt_BR", label: "Portugues BR" },
  { value: "zh_CN", label: "Chinese" },
];

const CURRENCY_OPTIONS = ["USD", "EUR", "GBP", "BRL", "XOF"];
const IMPORT_DELIVERY_COUNTRY = { value: "FR", label: "France (FR)" };

const SORT_OPTIONS = [
  { value: "orders,desc", label: "Commandes decroissant" },
  { value: "orders,asc", label: "Commandes croissant" },
  { value: "min_price,asc", label: "Prix minimum croissant" },
  { value: "min_price,desc", label: "Prix minimum decroissant" },
  { value: "comments,desc", label: "Avis decroissant" },
  { value: "comments,asc", label: "Avis croissant" },
];

const SEARCH_EXTEND_OPTIONS = [
  { value: "free_ship_to", label: "Livraison gratuite vers" },
  { value: "item_tag", label: "Produit de choix" },
  { value: "seller_level", label: "Niveau vendeur" },
  { value: "ship_from", label: "Expedie depuis" },
  { value: "seller_online", label: "Vendeur en ligne < heures" },
  { value: "hot_area", label: "Zone chaude" },
];

function fetchAdminSourcing(path: string, init?: RequestInit) {
  return fetch(buildApiUrl(path), {
    credentials: "include",
    ...init,
  });
}

function formatImportedPrice(product: AlibabaImportedProduct) {
  return formatTierAwarePrice((amountUsd) => `$${amountUsd.toFixed(2)}`, product);
}

function formatPreviewPrice(item: SearchPreviewItem) {
  if (item.salePriceFormat) {
    return item.salePriceFormat;
  }

  if (item.targetSalePrice && item.targetOriginalPriceCurrency) {
    return `${item.targetSalePrice} ${item.targetOriginalPriceCurrency}`;
  }

  if (item.salePrice && item.salePriceCurrency) {
    return `${item.salePrice} ${item.salePriceCurrency}`;
  }

  if (typeof item.product?.minUsd === "number" && Number.isFinite(item.product.minUsd)) {
    return `$${item.product.minUsd.toFixed(2)}`;
  }

  return "Prix indisponible";
}

function formatCount(value: unknown) {
  return String(typeof value === "number" && Number.isFinite(value) ? value : 0);
}

function createRowId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeSearchExtendRows(rows: SearchExtendRow[]) {
  return rows.flatMap((row) => {
    const searchKey = row.searchKey.trim();
    const searchValue = row.searchValue.trim();
    const min = row.min.trim();
    const max = row.max.trim();
    if (!searchKey && !searchValue && !min && !max) {
      return [] as Array<{ searchKey?: string; searchValue?: string; min?: string; max?: string }>;
    }

    return [{
      ...(searchKey ? { searchKey } : {}),
      ...(searchValue ? { searchValue } : {}),
      ...(min ? { min } : {}),
      ...(max ? { max } : {}),
    }];
  });
}

function hasRecoveredVideo(product: AlibabaImportedProduct) {
  return Boolean(product.videoUrl);
}

function getImportedCampaignLabel(product: AlibabaImportedProduct) {
  if (!product.rawPayload || typeof product.rawPayload !== "object" || Array.isArray(product.rawPayload)) {
    return null;
  }

  const campaign = (product.rawPayload as Record<string, unknown>).afripayCampaign;
  if (!campaign || typeof campaign !== "object" || Array.isArray(campaign)) {
    return null;
  }

  switch ((campaign as Record<string, unknown>).mode) {
    case "trends-promo":
      return "Tendances promo";
    case "trends-hot":
      return "Tendances hot";
    case "mode-fashion":
      return "Mode";
    case "free-deal":
      return "Articles gratuits";
    default:
      return null;
  }
}

export function AdminAliExpressImportCatalogClient({ initialDashboard, adminApiBasePath = "/api/admin/aliexpress" }: { initialDashboard: DashboardData; adminApiBasePath?: string }) {
  const router = useRouter();
  const [isRefreshing, startRefreshTransition] = useTransition();
  const connectedAccounts = useMemo(
    () => initialDashboard.supplierAccounts.filter((account) => account.status === "connected"),
    [initialDashboard.supplierAccounts],
  );
  const defaultCountry = IMPORT_DELIVERY_COUNTRY.value;
  const [selectedSupplierAccountId, setSelectedSupplierAccountId] = useState(
    initialDashboard.supplierAccounts.find((account) => account.isActive && account.status === "connected")?.id
      ?? connectedAccounts[0]?.id
      ?? initialDashboard.supplierAccounts[0]?.id
      ?? "",
  );
  const [searchForm, setSearchForm] = useState({
    query: "",
    local: "fr_FR",
    countryCode: defaultCountry,
    categoryId: "",
    sortBy: "orders,desc",
    pageSize: 12,
    pageIndex: 1,
    currency: "USD",
    selectionName: "",
  });
  const [searchExtendRows, setSearchExtendRows] = useState<SearchExtendRow[]>([]);
  const [searchState, setSearchState] = useState<SearchResponse | null>(null);
  const [recentlyImportedSourceProductIds, setRecentlyImportedSourceProductIds] = useState<string[]>([]);
  const [selectedPreviewIds, setSelectedPreviewIds] = useState<string[]>([]);
  const [selectedImportedProductIds, setSelectedImportedProductIds] = useState<string[]>([]);
  const [quantityByProduct, setQuantityByProduct] = useState<Record<string, number>>({});
  const [isSearching, setIsSearching] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isDeletingImported, setIsDeletingImported] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [importForm, setImportForm] = useState({
    fulfillmentChannel: "crossborder",
    campaignMode: "standard" as AlibabaImportCampaignMode,
    autoPublish: true,
    resetImportedProducts: false,
  });
  const defaultAddressId = initialDashboard.addresses.find((address) => address.isDefault)?.id ?? initialDashboard.addresses[0]?.id;

  const importSupplierAccount = useMemo(
    () => initialDashboard.supplierAccounts.find((account) => account.id === selectedSupplierAccountId) ?? null,
    [initialDashboard.supplierAccounts, selectedSupplierAccountId],
  );
  const hiddenImportedSourceProductIds = useMemo(() => new Set([
    ...initialDashboard.importedProducts.map((product) => product.sourceProductId),
    ...recentlyImportedSourceProductIds,
  ]), [initialDashboard.importedProducts, recentlyImportedSourceProductIds]);
  const visibleSearchProducts = useMemo(
    () => (searchState?.products ?? []).filter((item) => !hiddenImportedSourceProductIds.has(item.productId)),
    [hiddenImportedSourceProductIds, searchState?.products],
  );
  const selectedPreviewItems = useMemo(
    () => visibleSearchProducts.filter((item) => selectedPreviewIds.includes(item.productId)),
    [visibleSearchProducts, selectedPreviewIds],
  );
  const importablePreviewCount = useMemo(
    () => selectedPreviewItems.filter((item) => item.importable && item.product).length,
    [selectedPreviewItems],
  );
  const allImportedProductIds = useMemo(
    () => initialDashboard.importedProducts.map((product) => product.id),
    [initialDashboard.importedProducts],
  );
  const allImportedSelected = allImportedProductIds.length > 0 && selectedImportedProductIds.length === allImportedProductIds.length;

  const refresh = () => {
    startRefreshTransition(() => {
      router.refresh();
    });
  };

  const runSearch = async (pageIndex = searchForm.pageIndex) => {
    setIsSearching(true);
    setFeedback(null);
    setErrorMessage(null);

    const response = await fetchAdminSourcing(`${adminApiBasePath}/search`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query: searchForm.query,
        local: searchForm.local,
        countryCode: searchForm.countryCode,
        categoryId: searchForm.categoryId.trim() || undefined,
        sortBy: searchForm.sortBy,
        pageSize: searchForm.pageSize,
        pageIndex,
        currency: searchForm.currency,
        selectionName: searchForm.selectionName.trim() || undefined,
        searchExtend: normalizeSearchExtendRows(searchExtendRows),
        supplierAccountId: selectedSupplierAccountId || undefined,
      }),
    });

    const payload = await response.json().catch(() => null) as SearchResponse & { message?: string } | null;
    if (!response.ok || !payload) {
      setSearchState(null);
      setSelectedPreviewIds([]);
      setErrorMessage(payload?.message ?? "Recherche AliExpress DS impossible.");
      setIsSearching(false);
      return;
    }

    setSearchForm((current) => ({ ...current, pageIndex: payload.pageIndex }));
    const visibleCount = payload.products.filter((item) => !hiddenImportedSourceProductIds.has(item.productId)).length;
    setSearchState(payload);
    setSelectedPreviewIds([]);
    setFeedback(`${visibleCount} resultat(s) disponibles sur ${payload.totalCount} au total.`);
    setIsSearching(false);
  };

  const importPreviewItems = async (items: SearchPreviewItem[]) => {
    const importableItems = items.filter((item) => item.importable && item.product);
    if (importableItems.length === 0) {
      setErrorMessage("Selection vide: choisis au moins un resultat importable.");
      return;
    }

    if (!importSupplierAccount || importSupplierAccount.status !== "connected") {
      setErrorMessage("Choisis d'abord un compte AliExpress connecte pour importer.");
      return;
    }

    setIsImporting(true);
    setFeedback(null);
    setErrorMessage(null);

    let importedCount = 0;
    const importedSourceProductIds: string[] = [];
    const failures: string[] = [];

    for (const [index, item] of importableItems.entries()) {
      const response = await fetchAdminSourcing(`${adminApiBasePath}/import`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          query: item.productId,
          limit: 1,
          fulfillmentChannel: importForm.fulfillmentChannel,
          campaignMode: importForm.campaignMode,
          autoPublish: importForm.campaignMode === "free-deal" ? true : importForm.autoPublish,
          resetImportedProducts: importForm.resetImportedProducts && index === 0,
          manualProductMode: true,
          supplierAccountId: importSupplierAccount.id,
          manualSeedQuery: item.title,
          prefetchedProduct: item.product,
        }),
      });

      const payload = await response.json().catch(() => null) as { message?: string; products?: unknown[] } | null;
      if (!response.ok) {
        failures.push(`${item.productId}: ${payload?.message ?? "echec"}`);
        continue;
      }

      importedCount += Array.isArray(payload?.products) ? payload.products.length : 0;
      importedSourceProductIds.push(item.productId);
    }

    setIsImporting(false);
    setSelectedPreviewIds([]);
    if (importedSourceProductIds.length > 0) {
      setRecentlyImportedSourceProductIds((current) => Array.from(new Set([...current, ...importedSourceProductIds])));
      setSearchState((current) => current
        ? { ...current, products: current.products.filter((item) => !importedSourceProductIds.includes(item.productId)) }
        : current);
    }
    refresh();

    if (failures.length > 0) {
      setErrorMessage(`Import termine avec ${failures.length} echec(s). ${failures.slice(0, 3).join(" | ")}`);
    }

    setFeedback(`Import termine: ${importedCount}/${importableItems.length} produit(s) importes.`);
  };

  const publishSelection = async () => {
    if (selectedImportedProductIds.length === 0) {
      setErrorMessage("Selectionne au moins un produit importe a publier.");
      return;
    }

    setIsPublishing(true);
    setFeedback(null);
    setErrorMessage(null);

    const response = await fetchAdminSourcing(`${adminApiBasePath}/publish`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ productIds: selectedImportedProductIds }),
    });

    const payload = await response.json().catch(() => null) as { message?: string } | null;
    setIsPublishing(false);
    if (!response.ok) {
      setErrorMessage(payload?.message ?? "Publication site impossible.");
      return;
    }

    setFeedback("Selection publiee sur le catalogue du site.");
    refresh();
  };

  const deleteImportedItem = async (importedProductId: string, sourceProductId?: string) => {
    if (!window.confirm("Supprimer cet article importe du catalogue admin ?")) {
      return;
    }

    setFeedback(null);
    setErrorMessage(null);

    const deleteUrl = sourceProductId
      ? `${adminApiBasePath}/import/${importedProductId}?sourceProductId=${encodeURIComponent(sourceProductId)}`
      : `${adminApiBasePath}/import/${importedProductId}`;
    const response = await fetchAdminSourcing(deleteUrl, { method: "DELETE" });
    const payload = await response.json().catch(() => null) as { message?: string } | null;
    if (!response.ok) {
      setErrorMessage(payload?.message ?? "Suppression impossible.");
      return;
    }

    setFeedback("Article importe supprime.");
    setSelectedImportedProductIds((current) => current.filter((item) => item !== importedProductId));
    if (sourceProductId) {
      setRecentlyImportedSourceProductIds((current) => current.filter((item) => item !== sourceProductId));
    }
    refresh();
  };

  const deleteSelectedImportedItems = async () => {
    if (selectedImportedProductIds.length === 0) {
      setErrorMessage("Selectionne au moins un article importe a supprimer.");
      return;
    }

    if (!window.confirm(`Supprimer ${selectedImportedProductIds.length} article(s) importe(s) selectionne(s) ?`)) {
      return;
    }

    setIsDeletingImported(true);
    setFeedback(null);
    setErrorMessage(null);

    const selected = new Set(selectedImportedProductIds);
    const productsToDelete = initialDashboard.importedProducts.filter((product) => selected.has(product.id));
    const failures: string[] = [];

    for (const product of productsToDelete) {
      const deleteUrl = product.sourceProductId
        ? `${adminApiBasePath}/import/${product.id}?sourceProductId=${encodeURIComponent(product.sourceProductId)}`
        : `${adminApiBasePath}/import/${product.id}`;
      const response = await fetchAdminSourcing(deleteUrl, { method: "DELETE" });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { message?: string } | null;
        failures.push(`${product.shortTitle}: ${payload?.message ?? "suppression impossible"}`);
      }
    }

    setIsDeletingImported(false);
    if (failures.length > 0) {
      setErrorMessage(`Suppression terminee avec ${failures.length} echec(s). ${failures.slice(0, 3).join(" | ")}`);
    } else {
      setFeedback(`${productsToDelete.length} article(s) importe(s) supprime(s).`);
    }
    setSelectedImportedProductIds([]);
    refresh();
  };

  const deleteAllImportedItems = async () => {
    if (initialDashboard.importedProducts.length === 0) {
      return;
    }

    if (!window.confirm(`Supprimer tous les ${initialDashboard.importedProducts.length} article(s) importes du catalogue admin ?`)) {
      return;
    }

    setIsDeletingImported(true);
    setFeedback(null);
    setErrorMessage(null);

    const response = await fetchAdminSourcing(`${adminApiBasePath}/import?siteReset=true`, { method: "DELETE" });
    const payload = await response.json().catch(() => null) as { message?: string; deletedCount?: number } | null;
    setIsDeletingImported(false);
    if (!response.ok) {
      setErrorMessage(payload?.message ?? "Suppression totale impossible.");
      return;
    }

    setSelectedImportedProductIds([]);
    setFeedback(`Catalogue importe purge: ${Number(payload?.deletedCount ?? 0)} article(s) supprime(s).`);
    refresh();
  };

  const reenrichImportedItem = async (importedProductId: string) => {
    setFeedback(null);
    setErrorMessage(null);

    const response = await fetchAdminSourcing(`${adminApiBasePath}/import/${importedProductId}/reenrich`, {
      method: "POST",
    });
    const payload = await response.json().catch(() => null) as { message?: string } | null;
    if (!response.ok) {
      setErrorMessage(payload?.message ?? "Reenrichissement impossible.");
      return;
    }

    setFeedback("Article reenrichi avec les donnees source les plus recentes.");
    refresh();
  };

  const createPurchaseOrder = async (importedProductId: string, sourceProductId?: string) => {
    if (!defaultAddressId) {
      setErrorMessage("Ajoute d'abord une adresse de reception avant de creer un lot d'achat.");
      return;
    }

    setFeedback(null);
    setErrorMessage(null);

    const response = await fetchAdminSourcing(`${adminApiBasePath}/purchase-orders`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        importedProductId,
        sourceProductId,
        quantity: quantityByProduct[importedProductId] ?? 1,
        shippingAddressId: defaultAddressId,
      }),
    });
    const payload = await response.json().catch(() => null) as { message?: string; order?: { payUrl?: string } } | null;
    if (!response.ok) {
      setErrorMessage(payload?.message ?? "Creation du lot d'achat impossible.");
      return;
    }

    setFeedback(payload?.order?.payUrl
      ? "Lot d'achat cree. Ouvre maintenant le lien de paiement AliExpress."
      : "Lot d'achat cree en brouillon ou sans lien de paiement.");
    refresh();
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[28px] border border-[#d7dfef] bg-[radial-gradient(circle_at_top_left,_rgba(255,116,41,0.18),_transparent_32%),linear-gradient(135deg,#fff8f1_0%,#ffffff_38%,#eef4ff_100%)] p-6 shadow-[0_16px_40px_rgba(15,23,42,0.08)] sm:p-7">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-[840px]">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-[12px] font-black uppercase tracking-[0.18em] text-[#d85c14] shadow-[0_8px_20px_rgba(15,23,42,0.06)]">
              <Sparkles className="h-4 w-4" />
              AliExpress DS text search
            </div>
            <h1 className="mt-4 max-w-[720px] text-[30px] font-black tracking-[-0.05em] text-[#101828] sm:text-[36px]">
              Recherche, previsualisation et import cible des produits `aliexpress.ds.text.search`
            </h1>
            <p className="mt-3 max-w-[760px] text-[14px] leading-7 text-[#475467]">
              La page d'import passe maintenant par une etape claire: tu recherches les produits DS, tu vois lesquels sont reellement importables apres verification `ds.product.get`, puis tu importes seulement les fiches choisies.
            </p>
            <div className="mt-5 flex flex-wrap gap-3 text-[13px] font-semibold text-[#344054]">
              <div className="rounded-[16px] bg-white px-4 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">{formatCount(initialDashboard.stats.importedCount)} produits importes</div>
              <div className="rounded-[16px] bg-white px-4 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">{formatCount(initialDashboard.stats.publishedCount)} produits publies</div>
              <div className="rounded-[16px] bg-white px-4 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">{formatCount(initialDashboard.purchaseOrders.length)} lots DS crees</div>
            </div>
          </div>

          <div className="grid min-w-[280px] gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <Link href="/products" className="inline-flex h-12 items-center justify-center gap-2 rounded-[16px] bg-[#111827] px-5 text-[14px] font-semibold text-white transition hover:bg-[#1f2937]">
              Voir le catalogue public
              <ShoppingBag className="h-4 w-4" />
            </Link>
            <div className="rounded-[16px] border border-white/70 bg-white/80 px-4 py-3 text-[12px] font-semibold leading-6 text-[#475467] shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
              {importSupplierAccount
                ? `Compte actif: ${importSupplierAccount.name} · ${importSupplierAccount.accountLogin ?? importSupplierAccount.email}`
                : "Aucun compte fournisseur connecte selectionne."}
            </div>
          </div>
        </div>

        {initialDashboard.storage.issue ? (
          <div className="mt-5 rounded-[18px] border border-[#fed7aa] bg-[#fff7ed] px-4 py-3 text-[13px] font-medium text-[#9a3412]">
            {initialDashboard.storage.issue}
          </div>
        ) : null}
        {feedback ? <div className="mt-5 rounded-[18px] border border-[#cce7d6] bg-[#effcf3] px-4 py-3 text-[13px] font-semibold text-[#166534]">{feedback}</div> : null}
        {errorMessage ? <div className="mt-3 rounded-[18px] border border-[#f3d1d1] bg-[#fff7f7] px-4 py-3 text-[13px] font-semibold text-[#b42318]">{errorMessage}</div> : null}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <article className="rounded-[24px] border border-[#e3e8f2] bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.05)] sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#d85c14]">Recherche fournisseur</div>
              <h2 className="mt-2 text-[24px] font-black tracking-[-0.05em] text-[#101828]">Parametres DS exacts</h2>
              <p className="mt-2 text-[13px] leading-6 text-[#667085]">Mot-cle, pays, locale, devise, categorie, tri, pagination, `selectionName` et `searchExtend` sont exposes directement dans l'interface. Pour l'import, le pays de livraison est verrouille sur la France.</p>
            </div>
            <button
              type="button"
              onClick={() => runSearch(1)}
              disabled={isSearching || !searchForm.query.trim()}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-[14px] bg-[#111827] px-5 text-[14px] font-semibold text-white transition hover:bg-[#1f2937] disabled:opacity-60"
            >
              {isSearching ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Lancer la recherche
            </button>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="text-[13px] font-semibold text-[#344054] md:col-span-2">
              Mot-cle
              <input value={searchForm.query} onChange={(event) => setSearchForm((current) => ({ ...current, query: event.target.value }))} placeholder="robe, airpods, 100500..., montre..." className="mt-2 h-11 w-full rounded-[14px] border border-[#d6dbe6] px-4 text-[14px] text-[#111827] outline-none focus:border-[#d85c14]" />
            </label>
            <label className="text-[13px] font-semibold text-[#344054]">
              Compte fournisseur
              <select value={selectedSupplierAccountId} onChange={(event) => setSelectedSupplierAccountId(event.target.value)} className="mt-2 h-11 w-full rounded-[14px] border border-[#d6dbe6] px-4 text-[14px] text-[#111827] outline-none focus:border-[#d85c14]">
                <option value="">Choisir un compte connecte</option>
                {connectedAccounts.map((account) => (
                  <option key={account.id} value={account.id}>{`${account.name} · ${account.accountLogin ?? account.email} · ${account.countryCode}`}</option>
                ))}
              </select>
            </label>
            <label className="text-[13px] font-semibold text-[#344054]">
              Pays de livraison
              <select value={IMPORT_DELIVERY_COUNTRY.value} disabled className="mt-2 h-11 w-full rounded-[14px] border border-[#d6dbe6] bg-[#f8fafc] px-4 text-[14px] text-[#111827] outline-none">
                <option value={IMPORT_DELIVERY_COUNTRY.value}>{IMPORT_DELIVERY_COUNTRY.label}</option>
              </select>
            </label>
            <label className="text-[13px] font-semibold text-[#344054]">
              Locale
              <select value={searchForm.local} onChange={(event) => setSearchForm((current) => ({ ...current, local: event.target.value }))} className="mt-2 h-11 w-full rounded-[14px] border border-[#d6dbe6] px-4 text-[14px] text-[#111827] outline-none focus:border-[#d85c14]">
                {LANGUAGE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="text-[13px] font-semibold text-[#344054]">
              Devise
              <select value={searchForm.currency} onChange={(event) => setSearchForm((current) => ({ ...current, currency: event.target.value }))} className="mt-2 h-11 w-full rounded-[14px] border border-[#d6dbe6] px-4 text-[14px] text-[#111827] outline-none focus:border-[#d85c14]">
                {CURRENCY_OPTIONS.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
              </select>
            </label>
            <label className="text-[13px] font-semibold text-[#344054]">
              Tri
              <select value={searchForm.sortBy} onChange={(event) => setSearchForm((current) => ({ ...current, sortBy: event.target.value }))} className="mt-2 h-11 w-full rounded-[14px] border border-[#d6dbe6] px-4 text-[14px] text-[#111827] outline-none focus:border-[#d85c14]">
                {SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="text-[13px] font-semibold text-[#344054]">
              Category ID
              <input value={searchForm.categoryId} onChange={(event) => setSearchForm((current) => ({ ...current, categoryId: event.target.value }))} placeholder="349" className="mt-2 h-11 w-full rounded-[14px] border border-[#d6dbe6] px-4 text-[14px] text-[#111827] outline-none focus:border-[#d85c14]" />
            </label>
            <label className="text-[13px] font-semibold text-[#344054]">
              Page size
              <select value={searchForm.pageSize} onChange={(event) => setSearchForm((current) => ({ ...current, pageSize: Number(event.target.value) || 12 }))} className="mt-2 h-11 w-full rounded-[14px] border border-[#d6dbe6] px-4 text-[14px] text-[#111827] outline-none focus:border-[#d85c14]">
                {[8, 12, 16, 20, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
            </label>
            <label className="text-[13px] font-semibold text-[#344054] md:col-span-2">
              Selection name
              <input value={searchForm.selectionName} onChange={(event) => setSearchForm((current) => ({ ...current, selectionName: event.target.value }))} placeholder="Evernet_B_NG_Selection" className="mt-2 h-11 w-full rounded-[14px] border border-[#d6dbe6] px-4 text-[14px] text-[#111827] outline-none focus:border-[#d85c14]" />
            </label>
          </div>

          <div className="mt-6 rounded-[20px] border border-[#edf1f6] bg-[#f8fafc] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#1d4f91]">Search extend</div>
                <div className="mt-1 text-[13px] text-[#667085]">Ajoute des filtres supportes par AliExpress comme `seller_online`, `ship_from` ou `free_ship_to`.</div>
              </div>
              <button type="button" onClick={() => setSearchExtendRows((current) => [...current, { id: createRowId(), searchKey: "", searchValue: "", min: "", max: "" }])} className="inline-flex h-10 items-center justify-center gap-2 rounded-[12px] border border-[#d6dbe6] bg-white px-4 text-[13px] font-semibold text-[#111827] transition hover:border-[#d85c14] hover:text-[#d85c14]">
                <WandSparkles className="h-4 w-4" />
                Ajouter un filtre
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {searchExtendRows.length === 0 ? <div className="rounded-[16px] bg-white px-4 py-3 text-[13px] text-[#667085]">Aucun filtre avance actif.</div> : searchExtendRows.map((row) => (
                <div key={row.id} className="grid gap-3 rounded-[16px] bg-white p-3 md:grid-cols-[1.2fr_1fr_0.7fr_0.7fr_auto]">
                  <select value={row.searchKey} onChange={(event) => setSearchExtendRows((current) => current.map((entry) => entry.id === row.id ? { ...entry, searchKey: event.target.value } : entry))} className="h-11 rounded-[12px] border border-[#d6dbe6] px-3 text-[13px] text-[#111827] outline-none focus:border-[#d85c14]">
                    <option value="">Choisir une cle</option>
                    {SEARCH_EXTEND_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  <input value={row.searchValue} onChange={(event) => setSearchExtendRows((current) => current.map((entry) => entry.id === row.id ? { ...entry, searchValue: event.target.value } : entry))} placeholder="Valeur" className="h-11 rounded-[12px] border border-[#d6dbe6] px-3 text-[13px] text-[#111827] outline-none focus:border-[#d85c14]" />
                  <input value={row.min} onChange={(event) => setSearchExtendRows((current) => current.map((entry) => entry.id === row.id ? { ...entry, min: event.target.value } : entry))} placeholder="Min" className="h-11 rounded-[12px] border border-[#d6dbe6] px-3 text-[13px] text-[#111827] outline-none focus:border-[#d85c14]" />
                  <input value={row.max} onChange={(event) => setSearchExtendRows((current) => current.map((entry) => entry.id === row.id ? { ...entry, max: event.target.value } : entry))} placeholder="Max" className="h-11 rounded-[12px] border border-[#d6dbe6] px-3 text-[13px] text-[#111827] outline-none focus:border-[#d85c14]" />
                  <button type="button" onClick={() => setSearchExtendRows((current) => current.filter((entry) => entry.id !== row.id))} className="inline-flex h-11 items-center justify-center rounded-[12px] border border-[#f3d1d1] bg-[#fff7f7] px-4 text-[13px] font-semibold text-[#b42318] transition hover:bg-[#fff1f1]">Retirer</button>
                </div>
              ))}
            </div>
          </div>
        </article>

        <article className="rounded-[24px] border border-[#e3e8f2] bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.05)] sm:p-6">
          <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#1d4f91]">Import cible</div>
          <h2 className="mt-2 text-[24px] font-black tracking-[-0.05em] text-[#101828]">Regles d'import de la selection</h2>
          <div className="mt-5 grid gap-4">
            <label className="text-[13px] font-semibold text-[#344054]">
              Flux d'achat
              <select value={importForm.fulfillmentChannel} onChange={(event) => setImportForm((current) => ({ ...current, fulfillmentChannel: event.target.value }))} className="mt-2 h-11 w-full rounded-[14px] border border-[#d6dbe6] px-4 text-[14px] text-[#111827] outline-none focus:border-[#1d4f91]">
                {FULFILLMENT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="text-[13px] font-semibold text-[#344054]">
              Destination storefront
              <select value={importForm.campaignMode} onChange={(event) => setImportForm((current) => ({ ...current, campaignMode: event.target.value as AlibabaImportCampaignMode }))} className="mt-2 h-11 w-full rounded-[14px] border border-[#d6dbe6] px-4 text-[14px] text-[#111827] outline-none focus:border-[#1d4f91]">
                {IMPORT_CAMPAIGN_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <div className="rounded-[16px] bg-[#eef4ff] px-4 py-3 text-[13px] text-[#1d4f91]">
              {IMPORT_CAMPAIGN_OPTIONS.find((option) => option.value === importForm.campaignMode)?.description}
            </div>
            <label className="inline-flex items-center gap-3 text-[13px] font-semibold text-[#344054]">
              <input checked={importForm.autoPublish} onChange={(event) => setImportForm((current) => ({ ...current, autoPublish: event.target.checked }))} type="checkbox" className="h-4 w-4 rounded border-[#d6dbe6] text-[#1d4f91] focus:ring-[#1d4f91]" />
              Publier automatiquement les produits importes
            </label>
            <label className="inline-flex items-center gap-3 text-[13px] font-semibold text-[#344054]">
              <input checked={importForm.resetImportedProducts} onChange={(event) => setImportForm((current) => ({ ...current, resetImportedProducts: event.target.checked }))} type="checkbox" className="h-4 w-4 rounded border-[#d6dbe6] text-[#1d4f91] focus:ring-[#1d4f91]" />
              Vider le catalogue importe avant le premier import de cette selection
            </label>
            <div className="rounded-[18px] border border-[#e5ecf7] bg-[linear-gradient(135deg,#ffffff_0%,#f6f9ff_100%)] p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">Selection courante</div>
              <div className="mt-2 text-[28px] font-black tracking-[-0.05em] text-[#101828]">{formatCount(importablePreviewCount)}</div>
              <div className="mt-1 text-[13px] text-[#667085]">resultat(s) importable(s) coches dans la page</div>
              {searchState?.requestId ? <div className="mt-3 rounded-[12px] bg-white px-3 py-2 text-[12px] font-semibold text-[#475467]">request_id {searchState.requestId}</div> : null}
            </div>
            <button type="button" onClick={() => importPreviewItems(selectedPreviewItems)} disabled={isImporting || importablePreviewCount === 0} className="inline-flex h-12 items-center justify-center gap-2 rounded-[16px] bg-[#1d4f91] px-5 text-[14px] font-semibold text-white transition hover:bg-[#173d71] disabled:opacity-60">
              {isImporting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Package2 className="h-4 w-4" />}
              Importer la selection
            </button>
          </div>
        </article>
      </section>

      <section className="rounded-[24px] border border-[#e3e8f2] bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.05)] sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#d85c14]">Resultats DS</div>
            <h2 className="mt-2 text-[24px] font-black tracking-[-0.05em] text-[#101828]">Previsualisation avant import</h2>
            <p className="mt-2 text-[13px] leading-6 text-[#667085]">Chaque carte provient de `aliexpress.ds.text.search`, puis est controlee avec `aliexpress.ds.product.get` pour savoir si elle reste importable.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => setSelectedPreviewIds([])} className="inline-flex h-10 items-center justify-center rounded-[12px] border border-[#d6dbe6] bg-white px-4 text-[13px] font-semibold text-[#344054] transition hover:border-[#d85c14] hover:text-[#d85c14]">Tout deselectionner</button>
            <div className="rounded-[14px] bg-[#fff6ed] px-4 py-2 text-[13px] font-semibold text-[#b45309]">{formatCount(selectedPreviewIds.length)} coche(s)</div>
          </div>
        </div>

        {searchState ? (
          <>
            <div className="mt-5 flex flex-col gap-3 rounded-[18px] bg-[#f8fafc] px-4 py-4 md:flex-row md:items-center md:justify-between">
              <div className="text-[13px] text-[#475467]">
                <span className="font-semibold text-[#101828]">{formatCount(visibleSearchProducts.length)}</span> resultat(s) affiches sur <span className="font-semibold text-[#101828]">{formatCount(searchState.totalCount)}</span>.
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => runSearch(Math.max(searchState.pageIndex - 1, 1))} disabled={isSearching || searchState.pageIndex <= 1} className="inline-flex h-10 items-center justify-center gap-2 rounded-[12px] border border-[#d6dbe6] bg-white px-4 text-[13px] font-semibold text-[#344054] transition hover:border-[#d85c14] hover:text-[#d85c14] disabled:opacity-60">
                  <ArrowLeft className="h-4 w-4" />
                  Prec.
                </button>
                <div className="rounded-[12px] bg-white px-4 py-2 text-[13px] font-semibold text-[#101828]">Page {searchState.pageIndex}</div>
                <button type="button" onClick={() => runSearch(searchState.pageIndex + 1)} disabled={isSearching || (searchState.pageIndex * searchState.pageSize) >= searchState.totalCount} className="inline-flex h-10 items-center justify-center gap-2 rounded-[12px] border border-[#d6dbe6] bg-white px-4 text-[13px] font-semibold text-[#344054] transition hover:border-[#d85c14] hover:text-[#d85c14] disabled:opacity-60">
                  Suiv.
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {visibleSearchProducts.length === 0 ? <div className="rounded-[18px] bg-[#f8fafc] px-4 py-4 text-[13px] text-[#667085]">Aucun resultat disponible pour ces parametres.</div> : visibleSearchProducts.map((item) => {
                const isSelected = selectedPreviewIds.includes(item.productId);
                return (
                  <article key={item.productId} className={`overflow-hidden rounded-[22px] border ${isSelected ? "border-[#1d4f91] shadow-[0_16px_36px_rgba(29,79,145,0.18)]" : "border-[#e8ecf3] shadow-[0_10px_24px_rgba(15,23,42,0.05)]"} bg-white transition`}>
                    <div className="relative aspect-[4/3] bg-[#f4f6f8]">
                      {item.imageUrl ? <Image src={item.imageUrl} alt={item.title} fill className="object-cover" sizes="(max-width: 768px) 100vw, 33vw" /> : null}
                      <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                        <div className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] ${item.importable ? "bg-[#eafaf0] text-[#15803d]" : "bg-[#fff1f1] text-[#b42318]"}`}>
                          {item.importable ? "Importable" : "A verifier"}
                        </div>
                        {item.importSource ? <div className="rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-[#344054]">{item.importSource === "detail" ? "DS detail" : "Fallback recherche"}</div> : null}
                      </div>
                    </div>

                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        <input type="checkbox" checked={isSelected} onChange={(event) => setSelectedPreviewIds((current) => event.target.checked ? [...current, item.productId] : current.filter((entry) => entry !== item.productId))} className="mt-1 h-4 w-4 rounded border-[#d6dbe6]" />
                        <div className="min-w-0 flex-1">
                          <div className="line-clamp-2 text-[15px] font-black leading-6 tracking-[-0.03em] text-[#101828]">{item.title}</div>
                          <div className="mt-2 text-[12px] font-semibold text-[#667085]">ID {item.productId}{item.categoryId ? ` · cate ${item.categoryId}` : ""}</div>
                        </div>
                      </div>

                      <div className="mt-4 flex items-end justify-between gap-3">
                        <div>
                          <div className="text-[20px] font-black tracking-[-0.04em] text-[#101828]">{formatPreviewPrice(item)}</div>
                          {item.originalPriceFormat ? <div className="mt-1 text-[12px] text-[#98a2b3] line-through">{item.originalPriceFormat}</div> : null}
                        </div>
                        {item.discount ? <div className="rounded-[12px] bg-[#fff6ed] px-3 py-2 text-[12px] font-bold text-[#b45309]">{item.discount}</div> : null}
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2 text-[12px] text-[#475467]">
                        <div className="rounded-[14px] bg-[#f8fafc] px-3 py-2">Commandes<br /><span className="font-semibold text-[#101828]">{item.orders ?? "-"}</span></div>
                        <div className="rounded-[14px] bg-[#f8fafc] px-3 py-2">Evaluation<br /><span className="font-semibold text-[#101828]">{item.evaluateRate ?? item.score ?? "-"}</span></div>
                        <div className="rounded-[14px] bg-[#f8fafc] px-3 py-2">Fournisseur<br /><span className="font-semibold text-[#101828]">{item.product?.supplierName ?? "AliExpress"}</span></div>
                        <div className="rounded-[14px] bg-[#f8fafc] px-3 py-2">MOQ / Stock<br /><span className="font-semibold text-[#101828]">{item.product ? `${item.product.moq} / ${formatCount(item.product.inventory)}` : "-"}</span></div>
                      </div>

                      {!item.importable && item.importReason ? <div className="mt-4 rounded-[14px] bg-[#fff7f7] px-3 py-3 text-[12px] font-medium text-[#b42318]">{item.importReason}</div> : null}

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button type="button" onClick={() => importPreviewItems([item])} disabled={isImporting || !item.importable || !item.product} className="inline-flex h-10 items-center justify-center gap-2 rounded-[12px] bg-[#111827] px-4 text-[13px] font-semibold text-white transition hover:bg-[#1f2937] disabled:opacity-60">
                          <Package2 className="h-4 w-4" />
                          Importer
                        </button>
                        {item.itemUrl ? (
                          <a href={item.itemUrl} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center gap-2 rounded-[12px] border border-[#d6dbe6] bg-white px-4 text-[13px] font-semibold text-[#344054] transition hover:border-[#d85c14] hover:text-[#d85c14]">
                            Ouvrir la fiche
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        ) : (
          <div className="mt-5 rounded-[18px] bg-[#f8fafc] px-4 py-4 text-[13px] text-[#667085]">Lance une recherche pour afficher les resultats DS previsualises.</div>
        )}
      </section>

      <section className="rounded-[24px] border border-[#e3e8f2] bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.05)] sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#1d4f91]">Catalogue importe</div>
            <h2 className="mt-2 text-[24px] font-black tracking-[-0.05em] text-[#101828]">Produits deja importes et actions rapides</h2>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => setSelectedImportedProductIds(allImportedSelected ? [] : allImportedProductIds)} disabled={initialDashboard.importedProducts.length === 0 || isDeletingImported} className="inline-flex h-10 items-center justify-center gap-2 rounded-[12px] border border-[#d6dbe6] bg-white px-4 text-[13px] font-semibold text-[#344054] transition hover:border-[#1d4f91] hover:text-[#1d4f91] disabled:opacity-60">
              {allImportedSelected ? "Tout deselectionner" : "Tout selectionner"}
            </button>
            <button type="button" onClick={publishSelection} disabled={isPublishing || selectedImportedProductIds.length === 0} className="inline-flex h-10 items-center justify-center gap-2 rounded-[12px] bg-[#1d4f91] px-4 text-[13px] font-semibold text-white transition hover:bg-[#173d71] disabled:opacity-60">
              {isPublishing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Publier la selection
            </button>
            <button type="button" onClick={deleteSelectedImportedItems} disabled={isDeletingImported || selectedImportedProductIds.length === 0} className="inline-flex h-10 items-center justify-center gap-2 rounded-[12px] border border-[#f3d1d1] bg-[#fff7f7] px-4 text-[13px] font-semibold text-[#b42318] transition hover:bg-[#fff1f1] disabled:opacity-60">
              {isDeletingImported ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Supprimer la selection
            </button>
            <button type="button" onClick={deleteAllImportedItems} disabled={isDeletingImported || initialDashboard.importedProducts.length === 0} className="inline-flex h-10 items-center justify-center gap-2 rounded-[12px] border border-[#f3d1d1] bg-white px-4 text-[13px] font-semibold text-[#b42318] transition hover:bg-[#fff7f7] disabled:opacity-60">
              Tout supprimer
            </button>
            <div className="rounded-[14px] bg-[#eef4ff] px-4 py-2 text-[13px] font-semibold text-[#1d4f91]">{formatCount(selectedImportedProductIds.length)} coche(s)</div>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {initialDashboard.importedProducts.length === 0 ? <div className="rounded-[18px] bg-[#f8fafc] px-4 py-4 text-[13px] text-[#667085]">Aucun article importe pour le moment.</div> : initialDashboard.importedProducts.map((product) => {
            const selected = selectedImportedProductIds.includes(product.id);
            return (
              <div key={product.id} className="rounded-[18px] border border-[#edf1f6] p-4">
                <div className="flex gap-3">
                  <input type="checkbox" checked={selected} onChange={(event) => setSelectedImportedProductIds((current) => event.target.checked ? [...current, product.id] : current.filter((entry) => entry !== product.id))} className="mt-2 h-4 w-4 rounded border-[#d6dbe6]" />
                  <div className="relative h-20 w-20 overflow-hidden rounded-[16px] bg-[#f5f5f5]">
                    <Image src={product.image} alt={product.shortTitle} fill className="object-cover" sizes="80px" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="line-clamp-2 text-[15px] font-black tracking-[-0.03em] text-[#101828]">{product.shortTitle}</div>
                        <div className="mt-1 text-[13px] text-[#667085]">{product.supplierName} · minimum {formatCount(product.moq)} {product.unit}</div>
                        <div className="mt-1 text-[12px] text-[#98a2b3]">{formatCount(product.gallery.length)} images · {hasRecoveredVideo(product) ? "video recuperee" : "pas de video"} · stock estime {formatCount(product.inventory)}</div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {getImportedCampaignLabel(product) ? <div className="rounded-full bg-[#eef4ff] px-3 py-1 text-[12px] font-semibold text-[#1d4f91]">{getImportedCampaignLabel(product)}</div> : null}
                        {product.publishedToSite ? <div className="rounded-full bg-[#eafaf0] px-3 py-1 text-[12px] font-semibold text-[#15803d]">Publie</div> : null}
                        <div className="rounded-full bg-[#fff7ed] px-3 py-1 text-[12px] font-semibold text-[#b45309]">{product.status}</div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <div>
                        <div className="text-[15px] font-bold text-[#101828]">{formatImportedPrice(product)}</div>
                        {formatTierAwarePriceMeta(product) ? <div className="mt-1 text-[11px] text-[#667085]">{formatTierAwarePriceMeta(product)}</div> : null}
                      </div>
                      <input value={quantityByProduct[product.id] ?? product.moq ?? 1} onChange={(event) => setQuantityByProduct((current) => ({ ...current, [product.id]: Number(event.target.value) || 1 }))} type="number" min={1} className="h-10 w-28 rounded-[12px] border border-[#d6dbe6] px-3 text-[13px] text-[#111827] outline-none focus:border-[#1d4f91]" />
                      <button type="button" onClick={() => createPurchaseOrder(product.id, product.sourceProductId)} className="inline-flex h-10 items-center justify-center gap-2 rounded-[12px] bg-[#111827] px-4 text-[13px] font-semibold text-white transition hover:bg-[#1f2937]">
                        <Warehouse className="h-4 w-4" />
                        Creer un lot DS
                      </button>
                      <button type="button" onClick={() => reenrichImportedItem(product.id)} className="inline-flex h-10 items-center justify-center gap-2 rounded-[12px] border border-[#d6dbe6] bg-white px-4 text-[13px] font-semibold text-[#344054] transition hover:border-[#1d4f91] hover:text-[#1d4f91]">
                        <RefreshCcw className="h-4 w-4" />
                        Reenrichir
                      </button>
                      <button type="button" onClick={() => deleteImportedItem(product.id, product.sourceProductId)} className="inline-flex h-10 items-center justify-center gap-2 rounded-[12px] border border-[#f3d1d1] bg-[#fff7f7] px-4 text-[13px] font-semibold text-[#b42318] transition hover:bg-[#fff1f1]">
                        <Trash2 className="h-4 w-4" />
                        Supprimer
                      </button>
                      {product.publishedToSite ? (
                        <Link href={`/products/${encodeURIComponent(product.slug)}`} className="inline-flex h-10 items-center justify-center gap-2 rounded-[12px] border border-[#d6dbe6] bg-white px-4 text-[13px] font-semibold text-[#1d4f91] transition hover:border-[#1d4f91] hover:text-[#173d71]">
                          Voir produit
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5 flex items-center justify-end">
          <button type="button" onClick={refresh} disabled={isRefreshing} className="inline-flex h-10 items-center justify-center gap-2 rounded-[12px] border border-[#d6dbe6] bg-white px-4 text-[13px] font-semibold text-[#344054] transition hover:border-[#1d4f91] hover:text-[#1d4f91] disabled:opacity-60">
            {isRefreshing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            Actualiser le catalogue importe
          </button>
        </div>
      </section>
    </div>
  );
}
