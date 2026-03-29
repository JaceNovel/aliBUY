"use client";

import Image from "next/image";
import Link from "next/link";
import { Boxes, Building2, CheckCircle2, Globe2, MapPin, Package2, RefreshCcw, Search, ShoppingBag, Trash2, Wallet } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import type {
  AlibabaCountryProfile,
  AlibabaImportJob,
  AlibabaImportedProduct,
  AlibabaPanelSlug,
  AlibabaPurchaseOrder,
  AlibabaReceptionAddress,
  AlibabaReceptionRecord,
  AlibabaSupplierAccount,
} from "@/lib/alibaba-operations";
import { buildApiUrl } from "@/lib/api";
import type { AlibabaCatalogMapping } from "@/lib/alibaba-sourcing";
import { formatTierAwarePrice, formatTierAwarePriceMeta } from "@/lib/product-price-display";

type DashboardData = {
  panel: AlibabaPanelSlug;
  mappings: AlibabaCatalogMapping[];
  importJobs: AlibabaImportJob[];
  importedProducts: AlibabaImportedProduct[];
  purchaseOrders: AlibabaPurchaseOrder[];
  supplierAccounts: AlibabaSupplierAccount[];
  countries: AlibabaCountryProfile[];
  addresses: AlibabaReceptionAddress[];
  receptions: AlibabaReceptionRecord[];
  stats: {
    importedCount: number;
    publishedCount: number;
    pendingPayments: number;
    paidOrders: number;
  };
};

type Props = {
  initialDashboard: DashboardData;
};

const panelLinks: Array<{ key: AlibabaPanelSlug; label: string; href: string }> = [
  { key: "dashboard", label: "Tableau de bord", href: "/admin/aliexpress-sourcing" },
  { key: "accounts", label: "Comptes fournisseurs", href: "/admin/aliexpress-sourcing/accounts" },
  { key: "import-catalog", label: "Import catalogue", href: "/admin/aliexpress-sourcing/import-catalog" },
  { key: "countries", label: "Pays", href: "/admin/aliexpress-sourcing/countries" },
  { key: "addresses", label: "Adresses reception", href: "/admin/aliexpress-sourcing/addresses" },
  { key: "mappings", label: "Mappings produit-source", href: "/admin/aliexpress-sourcing/mappings" },
  { key: "requests", label: "Demandes", href: "/admin/aliexpress-sourcing/requests" },
  { key: "lots", label: "Groupes prets", href: "/admin/aliexpress-sourcing/lots" },
  { key: "sourcing-lots", label: "Lots d'achat", href: "/admin/aliexpress-sourcing/sourcing-lots" },
  { key: "receptions", label: "Receptions", href: "/admin/aliexpress-sourcing/receptions" },
];

const ALIEXPRESS_DEFAULT_AUTHORIZE_URL = "https://api-sg.aliexpress.com/oauth/authorize";
const ALIEXPRESS_DEFAULT_TOKEN_URL = "https://api-sg.aliexpress.com/rest/auth/token/security/create";
const ALIEXPRESS_DEFAULT_REFRESH_URL = "https://api-sg.aliexpress.com/rest/auth/token/security/refresh";
const ALIEXPRESS_DEFAULT_API_BASE_URL = "https://api-sg.aliexpress.com";

function formatImportedPrice(product: AlibabaImportedProduct) {
  return formatTierAwarePrice((amountUsd) => `$${amountUsd.toFixed(2)}`, product);
}

function formatCount(value: unknown) {
  return String(typeof value === "number" && Number.isFinite(value) ? value : 0);
}

function formatUsd(value: unknown) {
  const amount = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return `$${amount.toFixed(2)}`;
}

function hasRecoveredVideo(product: AlibabaImportedProduct) {
  return Boolean(product.videoUrl);
}

function submitOAuthAuthorizationForm(payload: Record<string, string>) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = buildApiUrl("/api/admin/aliexpress/supplier-accounts/oauth/start");
  form.style.display = "none";

  for (const [key, value] of Object.entries(payload)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = key;
    input.value = value;
    form.append(input);
  }

  document.body.append(form);
  form.submit();
  form.remove();
}

export function AdminAliExpressOperationsClient({ initialDashboard }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [importForm, setImportForm] = useState({ query: "", limit: 24, fulfillmentChannel: "crossborder", autoPublish: true });
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [quantityByProduct, setQuantityByProduct] = useState<Record<string, number>>({});
  const [accountForm, setAccountForm] = useState({
    id: "",
    name: "",
    email: "",
    memberId: "",
    resourceOwner: "",
    appKey: "",
    appSecret: "",
    authorizeUrl: ALIEXPRESS_DEFAULT_AUTHORIZE_URL,
    tokenUrl: ALIEXPRESS_DEFAULT_TOKEN_URL,
    refreshUrl: ALIEXPRESS_DEFAULT_REFRESH_URL,
    apiBaseUrl: ALIEXPRESS_DEFAULT_API_BASE_URL,
    accountPlatform: "seller",
    countryCode: "CI",
    defaultDispatchLocation: "CN",
    status: "needs_auth",
    isActive: true,
    accessTokenHint: "",
  });
  const [addressForm, setAddressForm] = useState({ label: "Entrepot principal", contactName: "", phone: "", email: "", addressLine1: "", addressLine2: "", city: "", state: "", postalCode: "", countryCode: "CI", port: "", portCode: "", isDefault: true });
  const [countries, setCountries] = useState(initialDashboard.countries);

  const defaultAddressId = initialDashboard.addresses.find((address) => address.isDefault)?.id;
  const recentImports = useMemo(() => initialDashboard.importedProducts.slice(0, 8), [initialDashboard.importedProducts]);
  const recentOrders = useMemo(() => initialDashboard.purchaseOrders.slice(0, 8), [initialDashboard.purchaseOrders]);
  const pendingPaymentOrders = useMemo(
    () => initialDashboard.purchaseOrders.filter((order) => order.paymentStatus === "pending" || order.paymentStatus === "pay_url_generated"),
    [initialDashboard.purchaseOrders],
  );
  const selectedSupplierAccount = useMemo(
    () => initialDashboard.supplierAccounts.find((account) => account.isActive) ?? initialDashboard.supplierAccounts[0] ?? null,
    [initialDashboard.supplierAccounts],
  );
  const activeSupplierAccount = useMemo(
    () => initialDashboard.supplierAccounts.find((account) => account.isActive && account.status === "connected") ?? initialDashboard.supplierAccounts.find((account) => account.status === "connected") ?? null,
    [initialDashboard.supplierAccounts],
  );
  const editingSupplierAccount = useMemo(
    () => accountForm.id ? initialDashboard.supplierAccounts.find((account) => account.id === accountForm.id) ?? null : null,
    [accountForm.id, initialDashboard.supplierAccounts],
  );
  const hasOauthCredentials = Boolean(accountForm.appKey.trim()) && (Boolean(accountForm.appSecret.trim()) || Boolean(editingSupplierAccount?.hasAppSecret));
  const seededQuery = useMemo(
    () => initialDashboard.panel === "import-catalog"
      ? (searchParams.get("q") ?? searchParams.get("seedQuery") ?? "").trim()
      : "",
    [initialDashboard.panel, searchParams],
  );
  const seededSource = useMemo(
    () => initialDashboard.panel === "import-catalog" ? (searchParams.get("source") ?? "").trim() : "",
    [initialDashboard.panel, searchParams],
  );
  const activeImportForm = useMemo(
    () => importForm.query.trim() || !seededQuery ? importForm : { ...importForm, query: seededQuery },
    [importForm, seededQuery],
  );
  const activeFeedback = feedback ?? (seededSource === "image-search" && seededQuery
    ? "Recherche image liee a l'import IA AliExpress. Verifie la requete puis lance l'import."
    : null);

  const refresh = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  const runImport = async () => {
    setFeedback(null);
    if (!activeSupplierAccount) {
      setFeedback(selectedSupplierAccount ? "Le compte selectionne n'est pas encore autorise. Clique sur Connecter pour terminer OAuth." : "Connecte d'abord un compte AliExpress actif pour lancer l'import live.");
      return;
    }
    const response = await fetch("/api/admin/aliexpress/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(activeImportForm),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setFeedback(payload?.message ?? "Import AliExpress impossible.");
      return;
    }
    if (payload?.warningMessage) {
      setFeedback(payload.warningMessage);
      refresh();
      return;
    }

    setFeedback(`Import AliExpress live termine: ${Array.isArray(payload?.products) ? payload.products.length : 0}/${payload?.targetImportCount ?? activeImportForm.limit} importes.${typeof payload?.skippedExistingCount === "number" && payload.skippedExistingCount > 0 ? ` Deja importes ignores: ${payload.skippedExistingCount}.` : ""}`);
    refresh();
  };

  const publishSelection = async () => {
    if (selectedProductIds.length === 0) {
      setFeedback("Selectionne au moins un article a publier.");
      return;
    }

    const response = await fetch("/api/admin/aliexpress/publish", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ productIds: selectedProductIds }),
    });

    if (!response.ok) {
      setFeedback("Publication site impossible.");
      return;
    }

    setFeedback("Articles publies sur le catalogue du site.");
    refresh();
  };

  const createPurchaseOrder = async (importedProductId: string) => {
    setFeedback(null);
    const response = await fetch("/api/admin/aliexpress/purchase-orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        importedProductId,
        quantity: quantityByProduct[importedProductId] ?? 1,
        shippingAddressId: defaultAddressId,
      }),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      setFeedback(payload?.message ?? "Creation du lot d'achat impossible.");
      return;
    }

    const payUrl = typeof payload?.order?.payUrl === "string" ? payload.order.payUrl : undefined;
    setFeedback(
      payUrl
        ? "Lot fournisseur lance. Ouvre maintenant le lien de paiement si AliExpress en a renvoye un."
        : "Lot fournisseur cree en brouillon ou lance sans lien de paiement. Utilise Actualiser pour relire le statut.",
    );
    refresh();
  };

  const deleteImportedItem = async (importedProductId: string) => {
    setFeedback(null);

    if (!window.confirm("Supprimer cet article importé du catalogue admin ?")) {
      return;
    }

    const response = await fetch(`/api/admin/aliexpress/import/${importedProductId}`, {
      method: "DELETE",
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      setFeedback(payload?.message ?? "Suppression de l'article importé impossible.");
      return;
    }

    setSelectedProductIds((current) => current.filter((entry) => entry !== importedProductId));
    setFeedback("Article importé supprimé.");
    refresh();
  };

  const reenrichImportedItem = async (importedProductId: string) => {
    setFeedback(null);

    const response = await fetch(`/api/admin/aliexpress/import/${importedProductId}/reenrich`, {
      method: "POST",
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      setFeedback(payload?.message ?? "Réenrichissement impossible.");
      return;
    }

    setFeedback("Article réenrichi avec les données fournisseur les plus récentes.");
    refresh();
  };

  const reenrichAllImportedItems = async () => {
    setFeedback(null);

    const response = await fetch("/api/admin/aliexpress/import/reenrich", {
      method: "POST",
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      setFeedback(payload?.message ?? "Réenrichissement global impossible.");
      return;
    }

    const updatedCount = Number(payload?.updatedCount ?? 0);
    const failedCount = Number(payload?.failedCount ?? 0);
    setFeedback(
      failedCount > 0
        ? `Réenrichissement global terminé: ${updatedCount} mis à jour, ${failedCount} en échec.`
        : `Réenrichissement global terminé: ${updatedCount} article(s) mis à jour.`,
    );
    refresh();
  };

  const payOrder = async (order: AlibabaPurchaseOrder, action: "pay" | "refresh") => {
    if (action === "pay" && order.payUrl) {
      const payWindow = window.open(order.payUrl, "_blank", "noopener,noreferrer");
      setFeedback(payWindow ? "Lien de paiement AliExpress ouvert dans un nouvel onglet." : "Le lien de paiement AliExpress est pret, mais le navigateur a bloque l'ouverture automatique.");
      return;
    }

    const pendingWindow = action === "pay" ? window.open("", "_blank", "noopener,noreferrer") : null;
    const response = await fetch(`/api/admin/aliexpress/purchase-orders/${order.id}/pay`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      pendingWindow?.close();
      setFeedback(action === "pay" ? "Action AliExpress impossible." : "Actualisation paiement impossible.");
      return;
    }

    const payUrl = typeof payload?.order?.payUrl === "string" ? payload.order.payUrl : undefined;
    if (action === "pay") {
      if (payUrl) {
        if (pendingWindow) {
          pendingWindow.location.href = payUrl;
        } else {
          window.open(payUrl, "_blank", "noopener,noreferrer");
        }
        setFeedback("Lien de paiement AliExpress ouvert. Termine le paiement dans l'onglet ouvert.");
      } else {
        pendingWindow?.close();
        setFeedback("Lot DS lance, mais aucun lien de paiement n'a été renvoye. Utilise Actualiser pour relire le statut.");
      }
    } else {
      setFeedback("Statut paiement actualise.");
    }
    refresh();
  };

  const saveAccount = async () => {
    const response = await fetch("/api/admin/aliexpress/supplier-accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(accountForm),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      setFeedback("Compte fournisseur impossible a enregistrer.");
      return;
    }

    setFeedback("Compte fournisseur enregistre.");
      setAccountForm({
      id: "",
      name: "",
      email: "",
      memberId: "",
      resourceOwner: "",
      appKey: "",
      appSecret: "",
      authorizeUrl: ALIEXPRESS_DEFAULT_AUTHORIZE_URL,
      tokenUrl: ALIEXPRESS_DEFAULT_TOKEN_URL,
      refreshUrl: ALIEXPRESS_DEFAULT_REFRESH_URL,
      apiBaseUrl: ALIEXPRESS_DEFAULT_API_BASE_URL,
      accountPlatform: "seller",
      countryCode: "CI",
      defaultDispatchLocation: "CN",
      status: "needs_auth",
      isActive: true,
      accessTokenHint: payload?.account?.accessTokenHint ?? "",
    });
    refresh();
  };

  const startOAuthAuthorization = async () => {
    setFeedback(null);

    if (!accountForm.appKey.trim()) {
      setFeedback("Ajoutez d'abord l'App Key avant de lancer OAuth.");
      return;
    }

    if (!accountForm.appSecret.trim() && !editingSupplierAccount?.hasAppSecret) {
      setFeedback("Ajoutez l'App Secret avant de lancer OAuth.");
      return;
    }

    submitOAuthAuthorizationForm({
      id: accountForm.id,
      name: accountForm.name,
      email: accountForm.email,
      memberId: accountForm.memberId,
      resourceOwner: accountForm.resourceOwner,
      appKey: accountForm.appKey,
      appSecret: accountForm.appSecret,
      authorizeUrl: accountForm.authorizeUrl,
      tokenUrl: accountForm.tokenUrl,
      refreshUrl: accountForm.refreshUrl,
      apiBaseUrl: accountForm.apiBaseUrl,
      accountPlatform: accountForm.accountPlatform,
      countryCode: accountForm.countryCode,
      defaultDispatchLocation: accountForm.defaultDispatchLocation,
      status: accountForm.status,
      isActive: String(accountForm.isActive),
      accessTokenHint: accountForm.accessTokenHint,
      origin: window.location.origin,
      responseMode: "redirect",
    });
  };

  const refreshAccountToken = async (accountId: string) => {
    setFeedback(null);
    const response = await fetch(`/api/admin/aliexpress/supplier-accounts/${accountId}/refresh`, {
      method: "POST",
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setFeedback(payload?.message ?? "Refresh du token AliExpress impossible.");
      return;
    }

    setFeedback("Token AliExpress rafraichi.");
    refresh();
  };

  const connectExistingAccount = async (accountId: string) => {
    setFeedback(null);
    submitOAuthAuthorizationForm({
      id: accountId,
      origin: window.location.origin,
      responseMode: "redirect",
    });
  };

  const saveAddress = async () => {
    const response = await fetch("/api/admin/aliexpress/reception-addresses", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(addressForm),
    });

    if (!response.ok) {
      setFeedback("Adresse de reception impossible a enregistrer.");
      return;
    }

    setFeedback("Adresse de reception enregistree.");
    refresh();
  };

  const saveCountries = async () => {
    const response = await fetch("/api/admin/aliexpress/country-profiles", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ profiles: countries }),
    });

    if (!response.ok) {
      setFeedback("Profils pays impossibles a enregistrer.");
      return;
    }

    setFeedback("Profils pays enregistres.");
    refresh();
  };

  const panel = initialDashboard.panel;

  return (
    <div className="space-y-5">
      <section className="rounded-[24px] border border-[#e6eaf0] bg-[linear-gradient(135deg,#fff5ef_0%,#ffffff_45%,#eef5ff_100%)] px-5 py-6 shadow-[0_8px_22px_rgba(17,24,39,0.05)] sm:px-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-[980px]">
            <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#ff6a3d]">Automatisation vendeur AliExpress</div>
            <h1 className="mt-2 text-[32px] font-black tracking-[-0.05em] text-[#1f2937]">Import catalogue, lots d&apos;achat et commandes AliExpress</h1>
            <p className="mt-3 text-[14px] leading-7 text-[#667085]">
              Recherche DS par mot-clé, récupération des attributs/SKU, marge 10%, publication catalogue site, création des lots internes puis lancement manuel
              des commandes AliExpress depuis le back-office.
            </p>
            <div className="mt-4 inline-flex flex-wrap items-center gap-2 rounded-[16px] bg-white px-4 py-3 text-[13px] text-[#475467] shadow-[0_8px_18px_rgba(17,24,39,0.05)]">
              <span className="font-semibold text-[#1f2937]">Compte selectionne:</span>
              <span>{selectedSupplierAccount ? `${selectedSupplierAccount.name} · ${selectedSupplierAccount.accountLogin ?? selectedSupplierAccount.email} · ${selectedSupplierAccount.status === "connected" ? "connecte" : "a autoriser"}` : "aucun compte configure"}</span>
            </div>
            {activeFeedback ? <div className="mt-4 rounded-[16px] bg-white px-4 py-3 text-[13px] font-semibold text-[#1f2937] shadow-[0_8px_18px_rgba(17,24,39,0.05)]">{activeFeedback}</div> : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[320px] xl:grid-cols-1">
            <Link href="/products" className="inline-flex h-12 items-center justify-center gap-2 rounded-[16px] bg-[#ff6a00] px-5 text-[14px] font-semibold text-white transition hover:bg-[#e55e00]">
              Voir le catalogue public
              <ShoppingBag className="h-4 w-4" />
            </Link>
            <Link href="/admin/imports/239826786001021591" className="inline-flex h-12 items-center justify-center gap-2 rounded-[16px] border border-[#dbe2ea] bg-white px-5 text-[14px] font-semibold text-[#1f2937] transition hover:border-[#ff6a00] hover:text-[#ff6a00]">
              Ouvrir le cockpit API
              <Boxes className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Articles importes", value: formatCount(initialDashboard.stats.importedCount), icon: Package2, accent: "bg-[#fff1e8] text-[#ff6a00]", href: "/admin/aliexpress-sourcing/import-catalog", hint: "Voir les articles importes" },
          { label: "Publies sur le site", value: formatCount(initialDashboard.stats.publishedCount), icon: CheckCircle2, accent: "bg-[#eafaf0] text-[#16a34a]", href: "/admin/aliexpress-sourcing/import-catalog", hint: "Voir les produits publies" },
          { label: "Paiements en attente", value: formatCount(initialDashboard.stats.pendingPayments), icon: Wallet, accent: "bg-[#eef4ff] text-[#2f67f6]", href: "/admin/aliexpress-sourcing/lots", hint: (typeof initialDashboard.stats.pendingPayments === "number" ? initialDashboard.stats.pendingPayments : 0) > 0 ? "Ouvrir les liens de paiement AliExpress" : "Aucun lien de paiement en attente" },
          { label: "Ordres payes", value: formatCount(initialDashboard.stats.paidOrders), icon: Building2, accent: "bg-[#f5efff] text-[#7c3aed]", href: "/admin/aliexpress-sourcing/lots", hint: "Voir les lots d'achat" },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.label} href={card.href} className="rounded-[18px] border border-[#e6eaf0] bg-white px-5 py-5 shadow-[0_8px_22px_rgba(17,24,39,0.05)] transition hover:-translate-y-0.5 hover:border-[#ffddb8] hover:shadow-[0_16px_36px_rgba(17,24,39,0.08)]">
              <div className={`inline-flex h-11 w-11 items-center justify-center rounded-[14px] ${card.accent}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="mt-4 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">{card.label}</div>
              <div className="mt-1 text-[24px] font-black tracking-[-0.05em] text-[#1f2937]">{card.value}</div>
              <div className="mt-2 text-[12px] font-semibold text-[#667085]">{card.hint}</div>
            </Link>
          );
        })}
      </section>

      {panel === "dashboard" && pendingPaymentOrders.length > 0 ? (
        <section className="rounded-[20px] border border-[#d8e4ff] bg-[#f5f9ff] px-5 py-4 shadow-[0_8px_22px_rgba(17,24,39,0.03)]">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#2f67f6]">Paiement AliExpress</div>
              <div className="mt-1 text-[18px] font-black tracking-[-0.04em] text-[#1f2937]">{pendingPaymentOrders.length} lien(s) de paiement AliExpress a ouvrir</div>
              <div className="mt-1 text-[13px] text-[#50637d]">Ouvre le panneau Groupes prets pour voir chaque lot, lancer le DS puis relire le statut.</div>
            </div>
            <Link href="/admin/aliexpress-sourcing/lots" className="inline-flex h-11 items-center justify-center rounded-[14px] bg-[#2f67f6] px-5 text-[14px] font-semibold text-white transition hover:bg-[#2557d6]">
              Ouvrir les groupes prets
            </Link>
          </div>
        </section>
      ) : null}

      <section className="overflow-x-auto rounded-[20px] border border-[#e6eaf0] bg-white p-3 shadow-[0_8px_22px_rgba(17,24,39,0.05)]">
        <div className="flex min-w-max gap-2">
          {panelLinks.map((item) => (
            <Link key={item.key} href={item.href} className={[
              "rounded-[14px] px-4 py-2.5 text-[13px] font-semibold transition",
              panel === item.key ? "bg-[#fff0ea] text-[#ff6234]" : "text-[#475467] hover:bg-[#f7f8fb]",
            ].join(" ")}>
              {item.label}
            </Link>
          ))}
        </div>
      </section>

      {(panel === "dashboard" || panel === "requests") ? (
        <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <article className="rounded-[20px] border border-[#e6eaf0] bg-white p-5 shadow-[0_8px_22px_rgba(17,24,39,0.05)]">
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#ff6a5b]">Derniers imports</div>
            <div className="mt-2 text-[22px] font-black tracking-[-0.04em] text-[#1f2937]">Demandes et lots generes</div>
            <div className="mt-4 space-y-3">
              {initialDashboard.importJobs.length === 0 ? <div className="rounded-[16px] bg-[#f8fafc] px-4 py-4 text-[13px] text-[#667085]">Aucune demande d&apos;import pour le moment.</div> : initialDashboard.importJobs.map((job) => (
                <div key={job.id} className="rounded-[16px] border border-[#edf1f6] px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[15px] font-semibold text-[#1f2937]">{job.query}</div>
                      <div className="mt-1 text-[13px] text-[#667085]">{formatCount(job.importedCount)} produits · limite {formatCount(job.limit)} · {job.fulfillmentChannel}</div>
                    </div>
                    <div className="rounded-full bg-[#fff7ed] px-3 py-1 text-[12px] font-semibold text-[#c2410c]">{job.status}</div>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-[20px] border border-[#e6eaf0] bg-white p-5 shadow-[0_8px_22px_rgba(17,24,39,0.05)]">
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#ff6a5b]">Achats AliExpress</div>
            <div className="mt-2 text-[22px] font-black tracking-[-0.04em] text-[#1f2937]">Lots, lancement DS et paiements</div>
            <div className="mt-4 space-y-3">
              {recentOrders.length === 0 ? <div className="rounded-[16px] bg-[#f8fafc] px-4 py-4 text-[13px] text-[#667085]">Aucun lot d&apos;achat cree pour le moment.</div> : recentOrders.map((order) => (
                <div key={order.id} className="rounded-[16px] border border-[#edf1f6] px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[15px] font-semibold text-[#1f2937]">{order.productTitle}</div>
                      <div className="mt-1 text-[13px] text-[#667085]">{formatCount(order.quantity)} unites · {order.supplierName}</div>
                      {order.payUrl ? <a href={order.payUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-[12px] font-semibold text-[#2f67f6]">Ouvrir le lien de paiement AliExpress</a> : null}
                    </div>
                    <div className="text-right">
                      <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#98a2b3]">{order.paymentStatus}</div>
                      <div className="mt-1 text-[14px] font-semibold text-[#1f2937]">{formatUsd(order.amountUsd)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>
      ) : null}

      {panel === "import-catalog" ? (
        <section className="grid gap-4 xl:grid-cols-[0.88fr_1.12fr]">
          <article className="rounded-[20px] border border-[#e6eaf0] bg-white p-5 shadow-[0_8px_22px_rgba(17,24,39,0.05)]">
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#ff6a5b]">Import catalogue</div>
            <div className="mt-2 text-[22px] font-black tracking-[-0.04em] text-[#1f2937]">Recherche AliExpress par mot-cle, SKU ou modele</div>
            <div className="mt-3 rounded-[14px] bg-[#f8fafc] px-4 py-3 text-[13px] text-[#667085]">
              {activeSupplierAccount
                ? `Import live via ${activeSupplierAccount.name} (${activeSupplierAccount.accountLogin ?? activeSupplierAccount.email}). Les references exactes interrogent d'abord AliExpress DS puis enrichissent la fiche detail avec variantes, attributs et medias.`
                : selectedSupplierAccount
                  ? `Le compte selectionne est ${selectedSupplierAccount.status === "connected" ? "connecte" : "en attente d'autorisation"}. Termine OAuth dans l'onglet Comptes fournisseurs avant l'import.`
                  : "Aucun compte AliExpress configure. Ajoute et autorise un compte dans l'onglet Comptes fournisseurs avant l'import."}
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="text-[13px] font-semibold text-[#344054] sm:col-span-2">
                Mot-cle ou reference exacte
                <input value={activeImportForm.query} onChange={(event) => setImportForm((current) => ({ ...current, query: event.target.value }))} placeholder="3523LDS, BCD126748, bague, piercing..." className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] text-[#111827] outline-none focus:border-[#ff6a00]" />
              </label>
              <label className="text-[13px] font-semibold text-[#344054]">
                Nombre a importer
                <input value={activeImportForm.limit} onChange={(event) => setImportForm((current) => ({ ...current, limit: Number(event.target.value) }))} type="number" min={1} max={100} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] text-[#111827] outline-none focus:border-[#ff6a00]" />
              </label>
              <label className="text-[13px] font-semibold text-[#344054]">
                Flux fournisseur
                <select value={activeImportForm.fulfillmentChannel} onChange={(event) => setImportForm((current) => ({ ...current, fulfillmentChannel: event.target.value }))} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] text-[#111827] outline-none focus:border-[#ff6a00]">
                  <option value="standard_us">Standard US</option>
                  <option value="crossborder">Crossborder</option>
                  <option value="fast_us">Fast US 48h</option>
                  <option value="mexico">Mexique</option>
                  <option value="best_seller_us">Best seller US</option>
                  <option value="best_seller_mexico">Best seller Mexique</option>
                </select>
              </label>
            </div>
            <label className="mt-4 inline-flex items-center gap-3 text-[13px] font-semibold text-[#344054]">
              <input checked={activeImportForm.autoPublish} onChange={(event) => setImportForm((current) => ({ ...current, autoPublish: event.target.checked }))} type="checkbox" className="h-4 w-4 rounded border-[#d7dce5] text-[#ff6a00] focus:ring-[#ff6a00]" />
              Publier automatiquement les articles importes sur le site
            </label>
            <div className="mt-5 flex gap-3">
              <button type="button" onClick={runImport} disabled={isPending || !activeImportForm.query.trim() || !activeSupplierAccount} className="inline-flex h-11 items-center justify-center gap-2 rounded-[14px] bg-[#111827] px-5 text-[14px] font-semibold text-white transition hover:bg-[#1f2937] disabled:opacity-60">
                <Search className="h-4 w-4" />
                Importer maintenant
              </button>
              <button type="button" onClick={publishSelection} disabled={isPending || selectedProductIds.length === 0} className="inline-flex h-11 items-center justify-center gap-2 rounded-[14px] border border-[#dbe2ea] bg-white px-5 text-[14px] font-semibold text-[#1f2937] transition hover:border-[#ff6a00] hover:text-[#ff6a00] disabled:opacity-60">
                Publier la selection
              </button>
            </div>
          </article>

          <article className="rounded-[20px] border border-[#e6eaf0] bg-white p-5 shadow-[0_8px_22px_rgba(17,24,39,0.05)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#ff6a5b]">Articles importes</div>
                <div className="mt-2 text-[22px] font-black tracking-[-0.04em] text-[#1f2937]">Images, videos et publication catalogue</div>
              </div>
              <div className="flex items-center gap-3">
                <button type="button" onClick={reenrichAllImportedItems} className="inline-flex h-10 items-center justify-center gap-2 rounded-[12px] border border-[#dbe2ea] bg-white px-4 text-[13px] font-semibold text-[#1f2937] transition hover:border-[#ff6a00] hover:text-[#ff6a00]">
                  <RefreshCcw className="h-4 w-4" />
                  Réenrichir tout
                </button>
                <div className="text-[13px] text-[#667085]">{formatCount(initialDashboard.importedProducts.length)} lignes</div>
              </div>
            </div>
            <div className="mt-5 space-y-3 max-h-[860px] overflow-auto pr-1">
              {initialDashboard.importedProducts.length === 0 ? <div className="rounded-[16px] bg-[#f8fafc] px-4 py-4 text-[13px] text-[#667085]">Aucun article importe pour le moment.</div> : initialDashboard.importedProducts.map((product) => {
                const selected = selectedProductIds.includes(product.id);
                return (
                  <div key={product.id} className="rounded-[16px] border border-[#edf1f6] p-3">
                    <div className="flex gap-3">
                      <input type="checkbox" checked={selected} onChange={(event) => setSelectedProductIds((current) => event.target.checked ? [...current, product.id] : current.filter((entry) => entry !== product.id))} className="mt-2 h-4 w-4 rounded border-[#d7dce5]" />
                      <div className="relative h-20 w-20 overflow-hidden rounded-[14px] bg-[#f5f5f5]">
                        <Image src={product.image} alt={product.shortTitle} fill className="object-cover" sizes="80px" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="line-clamp-2 text-[15px] font-semibold text-[#1f2937]">{product.shortTitle}</div>
                            <div className="mt-1 text-[13px] text-[#667085]">{product.supplierName} · MOQ {formatCount(product.moq)} {product.unit}</div>
                            <div className="mt-1 text-[12px] text-[#98a2b3]">{formatCount(product.gallery.length)} images · {hasRecoveredVideo(product) ? "video recuperee" : "pas de video"} · stock estime {formatCount(product.inventory)}</div>
                          </div>
                          <div className="rounded-full bg-[#fff7ed] px-3 py-1 text-[12px] font-semibold text-[#c2410c]">{product.status}</div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-3">
                          <div>
                            <div className="text-[14px] font-bold text-[#111827]">{formatImportedPrice(product)}</div>
                            {formatTierAwarePriceMeta(product) ? <div className="mt-1 text-[11px] text-[#667085]">{formatTierAwarePriceMeta(product)}</div> : null}
                          </div>
                          <input value={quantityByProduct[product.id] ?? product.moq ?? 0} onChange={(event) => setQuantityByProduct((current) => ({ ...current, [product.id]: Number(event.target.value) }))} type="number" min={1} className="h-10 w-28 rounded-[12px] border border-[#d7dce5] px-3 text-[13px] text-[#111827] outline-none focus:border-[#ff6a00]" />
                          <button type="button" onClick={() => createPurchaseOrder(product.id)} className="inline-flex h-10 items-center justify-center rounded-[12px] bg-[#111827] px-4 text-[13px] font-semibold text-white transition hover:bg-[#1f2937]">Creer un lot DS</button>
                          <button type="button" onClick={() => reenrichImportedItem(product.id)} className="inline-flex h-10 items-center justify-center gap-2 rounded-[12px] border border-[#dbe2ea] bg-white px-4 text-[13px] font-semibold text-[#1f2937] transition hover:border-[#ff6a00] hover:text-[#ff6a00]">
                            <RefreshCcw className="h-4 w-4" />
                            Réenrichir
                          </button>
                          <button type="button" onClick={() => deleteImportedItem(product.id)} className="inline-flex h-10 items-center justify-center gap-2 rounded-[12px] border border-[#f2d1d1] bg-[#fff8f8] px-4 text-[13px] font-semibold text-[#c74444] transition hover:bg-[#fff1f1]">
                            <Trash2 className="h-4 w-4" />
                            Supprimer
                          </button>
                          {product.publishedToSite ? <span className="inline-flex h-10 items-center rounded-[12px] bg-[#eafaf0] px-4 text-[13px] font-semibold text-[#15803d]">Deja sur le site</span> : null}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </article>
        </section>
      ) : null}

      {panel === "accounts" ? (
        <section className="grid gap-4 xl:grid-cols-[0.86fr_1.14fr]">
          <article className="rounded-[20px] border border-[#e6eaf0] bg-white p-5 shadow-[0_8px_22px_rgba(17,24,39,0.05)]">
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#ff6a5b]">Compte AliExpress</div>
            <div className="mt-2 text-[22px] font-black tracking-[-0.04em] text-[#1f2937]">Autorisation seller / buyer / ISV</div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="text-[13px] font-semibold text-[#344054] sm:col-span-2">Nom<input value={accountForm.name} onChange={(event) => setAccountForm((current) => ({ ...current, name: event.target.value }))} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] outline-none focus:border-[#ff6a00]" /></label>
              <label className="text-[13px] font-semibold text-[#344054] sm:col-span-2">Email<input value={accountForm.email} onChange={(event) => setAccountForm((current) => ({ ...current, email: event.target.value }))} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] outline-none focus:border-[#ff6a00]" /></label>
              <label className="text-[13px] font-semibold text-[#344054]">Member ID<input value={accountForm.memberId} onChange={(event) => setAccountForm((current) => ({ ...current, memberId: event.target.value }))} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] outline-none focus:border-[#ff6a00]" /></label>
              <label className="text-[13px] font-semibold text-[#344054]">Resource owner<input value={accountForm.resourceOwner} onChange={(event) => setAccountForm((current) => ({ ...current, resourceOwner: event.target.value }))} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] outline-none focus:border-[#ff6a00]" /></label>
              <label className="text-[13px] font-semibold text-[#344054]">App Key<input value={accountForm.appKey} onChange={(event) => setAccountForm((current) => ({ ...current, appKey: event.target.value }))} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] outline-none focus:border-[#ff6a00]" /></label>
              <label className="text-[13px] font-semibold text-[#344054]">App Secret<input value={accountForm.appSecret} onChange={(event) => setAccountForm((current) => ({ ...current, appSecret: event.target.value }))} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] outline-none focus:border-[#ff6a00]" /></label>
              <label className="text-[13px] font-semibold text-[#344054] sm:col-span-2">URL d'autorisation<input value={accountForm.authorizeUrl} onChange={(event) => setAccountForm((current) => ({ ...current, authorizeUrl: event.target.value }))} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] outline-none focus:border-[#ff6a00]" /></label>
              <label className="text-[13px] font-semibold text-[#344054] sm:col-span-2">URL du token<input value={accountForm.tokenUrl} onChange={(event) => setAccountForm((current) => ({ ...current, tokenUrl: event.target.value }))} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] outline-none focus:border-[#ff6a00]" /></label>
              <label className="text-[13px] font-semibold text-[#344054] sm:col-span-2">URL de rafraîchissement<input value={accountForm.refreshUrl} onChange={(event) => setAccountForm((current) => ({ ...current, refreshUrl: event.target.value }))} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] outline-none focus:border-[#ff6a00]" /></label>
              <label className="text-[13px] font-semibold text-[#344054] sm:col-span-2">URL racine API<input value={accountForm.apiBaseUrl} onChange={(event) => setAccountForm((current) => ({ ...current, apiBaseUrl: event.target.value }))} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] outline-none focus:border-[#ff6a00]" /></label>
              <label className="text-[13px] font-semibold text-[#344054]">Plateforme<select value={accountForm.accountPlatform} onChange={(event) => setAccountForm((current) => ({ ...current, accountPlatform: event.target.value }))} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] outline-none focus:border-[#ff6a00]"><option value="buyer">Buyer</option><option value="seller">Seller</option><option value="isv">ISV</option></select></label>
              <label className="text-[13px] font-semibold text-[#344054]">Statut<select value={accountForm.status} onChange={(event) => setAccountForm((current) => ({ ...current, status: event.target.value }))} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] outline-none focus:border-[#ff6a00]"><option value="needs_auth">A autoriser</option><option value="connected">Connecte</option><option value="disabled">Desactive</option></select></label>
              <label className="text-[13px] font-semibold text-[#344054]">Pays<input value={accountForm.countryCode} onChange={(event) => setAccountForm((current) => ({ ...current, countryCode: event.target.value.toUpperCase() }))} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] outline-none focus:border-[#ff6a00]" /></label>
              <label className="text-[13px] font-semibold text-[#344054]">Dispatch<input value={accountForm.defaultDispatchLocation} onChange={(event) => setAccountForm((current) => ({ ...current, defaultDispatchLocation: event.target.value }))} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] outline-none focus:border-[#ff6a00]" /></label>
              <label className="text-[13px] font-semibold text-[#344054] sm:col-span-2">Indice token<input value={accountForm.accessTokenHint} onChange={(event) => setAccountForm((current) => ({ ...current, accessTokenHint: event.target.value }))} placeholder="Ex: buyer token connecte le 23/03" className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] outline-none focus:border-[#ff6a00]" /></label>
            </div>
            <label className="mt-4 inline-flex items-center gap-3 text-[13px] font-semibold text-[#344054]">
              <input checked={Boolean(accountForm.isActive)} onChange={(event) => setAccountForm((current) => ({ ...current, isActive: event.target.checked }))} type="checkbox" className="h-4 w-4 rounded border-[#d7dce5]" />
              Utiliser ce compte comme compte actif pour l&apos;import live
            </label>
            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" onClick={saveAccount} className="inline-flex h-11 items-center justify-center rounded-[14px] bg-[#111827] px-5 text-[14px] font-semibold text-white transition hover:bg-[#1f2937]">Enregistrer</button>
              <button type="button" onClick={startOAuthAuthorization} disabled={isPending} className="inline-flex h-11 items-center justify-center rounded-[14px] border border-[#dbe2ea] bg-white px-5 text-[14px] font-semibold text-[#1f2937] transition hover:border-[#ff6a00] hover:text-[#ff6a00] disabled:opacity-60">Autoriser OAuth</button>
            </div>
            <div className="mt-3 text-[12px] leading-5 text-[#667085]">
              {hasOauthCredentials
                ? "Le bouton OAuth est pret. Un clic ouvre la page de connexion vendeur AliExpress puis la demande d'autorisation."
                : editingSupplierAccount?.hasAppSecret
                  ? "Ajoutez l'App Key du compte puis cliquez sur Autoriser OAuth. Le secret deja enregistre sera reutilise."
                  : "Renseignez App Key et App Secret pour ouvrir la page OAuth AliExpress."}
            </div>
          </article>

          <article className="rounded-[20px] border border-[#e6eaf0] bg-white p-5 shadow-[0_8px_22px_rgba(17,24,39,0.05)]">
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#ff6a5b]">Comptes relies</div>
            <div className="mt-2 text-[22px] font-black tracking-[-0.04em] text-[#1f2937]">Buyer, seller et compte ISV</div>
            <div className="mt-4 space-y-3">
              {initialDashboard.supplierAccounts.length === 0 ? <div className="rounded-[16px] bg-[#f8fafc] px-4 py-4 text-[13px] text-[#667085]">Aucun compte fournisseur configure.</div> : initialDashboard.supplierAccounts.map((account) => (
                <div key={account.id} className="rounded-[16px] border border-[#edf1f6] px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[15px] font-semibold text-[#1f2937]">{account.name}</div>
                      <div className="mt-1 text-[13px] text-[#667085]">{account.email} · {account.accountPlatform} · {account.countryCode}</div>
                      <div className="mt-1 text-[12px] text-[#98a2b3]">{account.accountLogin ?? "connexion AliExpress a finaliser"} · {account.hasAccessToken ? "acces actif" : "acces a autoriser"} · {account.hasRefreshToken ? "renouvellement actif" : "renouvellement en attente"}</div>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {account.isActive ? <div className="rounded-full bg-[#eef4ff] px-3 py-1 text-[12px] font-semibold text-[#2f67f6]">Selectionne</div> : null}
                      <div className="rounded-full bg-[#fff7ed] px-3 py-1 text-[12px] font-semibold text-[#c2410c]">{account.status}</div>
                      <button type="button" onClick={() => setAccountForm({
                        id: account.id,
                        name: account.name,
                        email: account.email,
                        memberId: account.memberId ?? "",
                        resourceOwner: account.resourceOwner ?? "",
                        appKey: account.appKey ?? "",
                        appSecret: "",
                        authorizeUrl: account.authorizeUrl ?? ALIEXPRESS_DEFAULT_AUTHORIZE_URL,
                        tokenUrl: account.tokenUrl ?? ALIEXPRESS_DEFAULT_TOKEN_URL,
                        refreshUrl: account.refreshUrl ?? ALIEXPRESS_DEFAULT_REFRESH_URL,
                        apiBaseUrl: account.apiBaseUrl ?? ALIEXPRESS_DEFAULT_API_BASE_URL,
                        accountPlatform: account.accountPlatform,
                        countryCode: account.countryCode,
                        defaultDispatchLocation: account.defaultDispatchLocation,
                        status: account.status,
                        isActive: Boolean(account.isActive),
                        accessTokenHint: account.accessTokenHint ?? "",
                      })} className="inline-flex h-9 items-center justify-center rounded-[12px] border border-[#dbe2ea] px-3 text-[12px] font-semibold text-[#1f2937] transition hover:border-[#ff6a00] hover:text-[#ff6a00]">Editer</button>
                      <button type="button" onClick={() => connectExistingAccount(account.id)} className="inline-flex h-9 items-center justify-center rounded-[12px] border border-[#dbe2ea] px-3 text-[12px] font-semibold text-[#1f2937] transition hover:border-[#ff6a00] hover:text-[#ff6a00]">Connecter</button>
                      {account.hasRefreshToken ? <button type="button" onClick={() => refreshAccountToken(account.id)} className="inline-flex h-9 items-center justify-center rounded-[12px] border border-[#dbe2ea] px-3 text-[12px] font-semibold text-[#1f2937] transition hover:border-[#ff6a00] hover:text-[#ff6a00]">Refresh token</button> : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>
      ) : null}

      {panel === "countries" ? (
        <section className="rounded-[20px] border border-[#e6eaf0] bg-white p-5 shadow-[0_8px_22px_rgba(17,24,39,0.05)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#ff6a5b]">Pays & douane</div>
              <div className="mt-2 text-[22px] font-black tracking-[-0.04em] text-[#1f2937]">Regles import et transport par pays</div>
            </div>
            <button type="button" onClick={saveCountries} className="inline-flex h-11 items-center justify-center rounded-[14px] bg-[#111827] px-5 text-[14px] font-semibold text-white transition hover:bg-[#1f2937]">Enregistrer</button>
          </div>
          <div className="mt-5 space-y-3">
            {countries.map((country, index) => (
              <div key={country.countryCode} className="grid gap-3 rounded-[16px] border border-[#edf1f6] p-4 md:grid-cols-6">
                <input value={country.countryName} onChange={(event) => setCountries((current) => current.map((entry, innerIndex) => innerIndex === index ? { ...entry, countryName: event.target.value } : entry))} className="rounded-[12px] border border-[#d7dce5] px-3 py-2 text-[13px]" />
                <input value={country.countryCode} onChange={(event) => setCountries((current) => current.map((entry, innerIndex) => innerIndex === index ? { ...entry, countryCode: event.target.value.toUpperCase() } : entry))} className="rounded-[12px] border border-[#d7dce5] px-3 py-2 text-[13px]" />
                <input value={country.currencyCode} onChange={(event) => setCountries((current) => current.map((entry, innerIndex) => innerIndex === index ? { ...entry, currencyCode: event.target.value.toUpperCase() } : entry))} className="rounded-[12px] border border-[#d7dce5] px-3 py-2 text-[13px]" />
                <input value={country.defaultCarrierCode} onChange={(event) => setCountries((current) => current.map((entry, innerIndex) => innerIndex === index ? { ...entry, defaultCarrierCode: event.target.value } : entry))} className="rounded-[12px] border border-[#d7dce5] px-3 py-2 text-[13px]" />
                <input value={country.importTaxRate} onChange={(event) => setCountries((current) => current.map((entry, innerIndex) => innerIndex === index ? { ...entry, importTaxRate: Number(event.target.value) } : entry))} type="number" className="rounded-[12px] border border-[#d7dce5] px-3 py-2 text-[13px]" />
                <select value={country.customsMode} onChange={(event) => setCountries((current) => current.map((entry, innerIndex) => innerIndex === index ? { ...entry, customsMode: event.target.value === "personal" ? "personal" : "business" } : entry))} className="rounded-[12px] border border-[#d7dce5] px-3 py-2 text-[13px]"><option value="business">Business</option><option value="personal">Personal</option></select>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {panel === "addresses" ? (
        <section className="grid gap-4 xl:grid-cols-[0.86fr_1.14fr]">
          <article className="rounded-[20px] border border-[#e6eaf0] bg-white p-5 shadow-[0_8px_22px_rgba(17,24,39,0.05)]">
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#ff6a5b]">Adresse de reception</div>
            <div className="mt-2 text-[22px] font-black tracking-[-0.04em] text-[#1f2937]">Entrepot et destination logistique</div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {[
                ["label", "Label"], ["contactName", "Contact"], ["phone", "Telephone"], ["email", "Email"], ["addressLine1", "Adresse"], ["city", "Ville"], ["state", "Province"], ["postalCode", "Code postal"], ["countryCode", "Pays"], ["port", "Port"], ["portCode", "Code port"],
              ].map(([key, label]) => (
                <label key={key} className="text-[13px] font-semibold text-[#344054]">
                  {label}
                  <input value={String(addressForm[key as keyof typeof addressForm] ?? "")} onChange={(event) => setAddressForm((current) => ({ ...current, [key]: event.target.value }))} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] outline-none focus:border-[#ff6a00]" />
                </label>
              ))}
            </div>
            <label className="mt-4 inline-flex items-center gap-3 text-[13px] font-semibold text-[#344054]">
              <input checked={Boolean(addressForm.isDefault)} onChange={(event) => setAddressForm((current) => ({ ...current, isDefault: event.target.checked }))} type="checkbox" className="h-4 w-4 rounded border-[#d7dce5]" />
              Adresse par defaut pour les achats auto
            </label>
            <button type="button" onClick={saveAddress} className="mt-5 inline-flex h-11 items-center justify-center rounded-[14px] bg-[#111827] px-5 text-[14px] font-semibold text-white transition hover:bg-[#1f2937]">Enregistrer</button>
          </article>
          <article className="rounded-[20px] border border-[#e6eaf0] bg-white p-5 shadow-[0_8px_22px_rgba(17,24,39,0.05)]">
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#ff6a5b]">Adresses existantes</div>
            <div className="mt-2 text-[22px] font-black tracking-[-0.04em] text-[#1f2937]">Reception et clearance</div>
            <div className="mt-4 space-y-3">
              {initialDashboard.addresses.length === 0 ? <div className="rounded-[16px] bg-[#f8fafc] px-4 py-4 text-[13px] text-[#667085]">Aucune adresse enregistree.</div> : initialDashboard.addresses.map((address) => (
                <div key={address.id} className="rounded-[16px] border border-[#edf1f6] px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[15px] font-semibold text-[#1f2937]">{address.label}</div>
                      <div className="mt-1 text-[13px] text-[#667085]">{address.addressLine1}, {address.city}, {address.countryCode}</div>
                    </div>
                    {address.isDefault ? <div className="rounded-full bg-[#eafaf0] px-3 py-1 text-[12px] font-semibold text-[#15803d]">Defaut</div> : null}
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>
      ) : null}

      {panel === "mappings" ? (
        <section className="rounded-[20px] border border-[#e6eaf0] bg-white p-5 shadow-[0_8px_22px_rgba(17,24,39,0.05)]">
          <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#ff6a5b]">Mappings</div>
          <div className="mt-2 text-[22px] font-black tracking-[-0.04em] text-[#1f2937]">Correspondance produit site et source AliExpress</div>
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-left">
              <thead>
                <tr className="text-[12px] uppercase tracking-[0.08em] text-[#98a2b3]">
                  <th className="py-3 pr-4 font-semibold">Slug site</th>
                  <th className="py-3 pr-4 font-semibold">Product ID</th>
                  <th className="py-3 pr-4 font-semibold">Supplier</th>
                  <th className="py-3 pr-4 font-semibold">SKU</th>
                  <th className="py-3 pr-4 font-semibold">Dispatch</th>
                </tr>
              </thead>
              <tbody>
                {initialDashboard.mappings.length === 0 ? <tr><td colSpan={5} className="border-t border-[#edf1f6] py-4 text-[13px] text-[#667085]">Aucun mapping produit-source pour le moment.</td></tr> : initialDashboard.mappings.map((mapping) => (
                  <tr key={mapping.slug} className="border-t border-[#edf1f6] text-[13px] text-[#1f2937]">
                    <td className="py-3.5 pr-4 font-semibold">{mapping.slug}</td>
                    <td className="py-3.5 pr-4">{mapping.alibabaProductId ?? "-"}</td>
                    <td className="py-3.5 pr-4">{mapping.supplierCompanyId ?? "-"}</td>
                    <td className="py-3.5 pr-4">{mapping.skuId ?? "-"}</td>
                    <td className="py-3.5 pr-4">{mapping.dispatchLocation ?? "CN"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {panel === "lots" ? (
        <section className="rounded-[20px] border border-[#e6eaf0] bg-white p-5 shadow-[0_8px_22px_rgba(17,24,39,0.05)]">
          <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#ff6a5b]">Groupes prets</div>
          <div className="mt-2 text-[22px] font-black tracking-[-0.04em] text-[#1f2937]">Lots internes, lancement DS et suivi manuel</div>
          <div className="mt-5 space-y-3">
            {initialDashboard.purchaseOrders.length === 0 ? <div className="rounded-[16px] bg-[#f8fafc] px-4 py-4 text-[13px] text-[#667085]">Aucun lot fournisseur AliExpress.</div> : initialDashboard.purchaseOrders.map((order) => (
              <div key={order.id} className="rounded-[16px] border border-[#edf1f6] p-4">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div>
                    <div className="text-[16px] font-semibold text-[#1f2937]">{order.productTitle}</div>
                    <div className="mt-1 text-[13px] text-[#667085]">trade_id: {order.tradeId ?? "non retourne"} · {formatCount(order.quantity)} unites · {order.supplierName}</div>
                    <div className="mt-1 text-[13px] text-[#667085]">Etat ordre: {order.orderStatus} · paiement: {order.paymentStatus}</div>
                    {order.payFailureReason ? <div className="mt-1 text-[12px] font-semibold text-[#b42318]">{order.payFailureReason}</div> : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="rounded-[12px] bg-[#fff7ed] px-3 py-2 text-[13px] font-semibold text-[#c2410c]">{formatUsd(order.amountUsd)}</div>
                    {order.payUrl ? <a href={order.payUrl} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center rounded-[12px] border border-[#dbe2ea] px-4 text-[13px] font-semibold text-[#1f2937] transition hover:border-[#ff6a00] hover:text-[#ff6a00]">Lien paiement</a> : null}
                    <button type="button" onClick={() => payOrder(order, "pay")} className="inline-flex h-10 items-center justify-center gap-2 rounded-[12px] bg-[#111827] px-4 text-[13px] font-semibold text-white transition hover:bg-[#1f2937]"><Wallet className="h-4 w-4" />Lancer DS</button>
                    <button type="button" onClick={() => payOrder(order, "refresh")} className="inline-flex h-10 items-center justify-center gap-2 rounded-[12px] border border-[#dbe2ea] px-4 text-[13px] font-semibold text-[#1f2937] transition hover:border-[#ff6a00] hover:text-[#ff6a00]"><RefreshCcw className="h-4 w-4" />Actualiser</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {panel === "receptions" ? (
        <section className="rounded-[20px] border border-[#e6eaf0] bg-white p-5 shadow-[0_8px_22px_rgba(17,24,39,0.05)]">
          <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#ff6a5b]">Receptions</div>
          <div className="mt-2 text-[22px] font-black tracking-[-0.04em] text-[#1f2937]">Controle des lots attendus</div>
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-left">
              <thead>
                <tr className="text-[12px] uppercase tracking-[0.08em] text-[#98a2b3]">
                  <th className="py-3 pr-4 font-semibold">Produit</th>
                  <th className="py-3 pr-4 font-semibold">Attendu</th>
                  <th className="py-3 pr-4 font-semibold">Recu</th>
                  <th className="py-3 pr-4 font-semibold">Statut</th>
                </tr>
              </thead>
              <tbody>
                {initialDashboard.receptions.length === 0 ? <tr><td colSpan={4} className="border-t border-[#edf1f6] py-4 text-[13px] text-[#667085]">Aucune reception en cours.</td></tr> : initialDashboard.receptions.map((reception) => (
                  <tr key={reception.id} className="border-t border-[#edf1f6] text-[13px] text-[#1f2937]">
                    <td className="py-3.5 pr-4 font-semibold">{reception.productTitle}</td>
                    <td className="py-3.5 pr-4">{formatCount(reception.quantityExpected)}</td>
                    <td className="py-3.5 pr-4">{formatCount(reception.quantityReceived)}</td>
                    <td className="py-3.5 pr-4">{reception.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {panel === "dashboard" ? (
        <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          {[
            { title: "Comptes fournisseurs", value: formatCount(initialDashboard.supplierAccounts.length), icon: Building2, href: "/admin/aliexpress-sourcing/accounts" },
            { title: "Pays actifs", value: formatCount(initialDashboard.countries.filter((item) => item.enabled).length), icon: Globe2, href: "/admin/aliexpress-sourcing/countries" },
            { title: "Adresses reception", value: formatCount(initialDashboard.addresses.length), icon: MapPin, href: "/admin/aliexpress-sourcing/addresses" },
            { title: "Produits recents", value: formatCount(recentImports.length), icon: Package2, href: "/admin/aliexpress-sourcing/import-catalog" },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.title} href={item.href} className="rounded-[20px] border border-[#e6eaf0] bg-white p-5 shadow-[0_8px_22px_rgba(17,24,39,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(17,24,39,0.08)]">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-[14px] bg-[#fff1e8] text-[#ff6a00]">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="mt-4 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">{item.title}</div>
                <div className="mt-1 text-[24px] font-black tracking-[-0.05em] text-[#1f2937]">{item.value}</div>
              </Link>
            );
          })}
        </section>
      ) : null}
    </div>
  );
}

export { AdminAliExpressOperationsClient as AdminAlibabaOperationsClient };
