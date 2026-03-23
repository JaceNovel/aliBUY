"use client";

import Image from "next/image";
import Link from "next/link";
import { Boxes, Building2, CheckCircle2, Globe2, MapPin, Package2, RefreshCcw, Search, ShoppingBag, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
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
import type { AlibabaCatalogMapping } from "@/lib/alibaba-sourcing";

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
  { key: "dashboard", label: "Tableau de bord", href: "/admin/alibaba-sourcing" },
  { key: "accounts", label: "Comptes fournisseurs", href: "/admin/alibaba-sourcing/accounts" },
  { key: "import-catalog", label: "Import catalogue", href: "/admin/alibaba-sourcing/import-catalog" },
  { key: "countries", label: "Pays", href: "/admin/alibaba-sourcing/countries" },
  { key: "addresses", label: "Adresses reception", href: "/admin/alibaba-sourcing/addresses" },
  { key: "mappings", label: "Mappings produit-source", href: "/admin/alibaba-sourcing/mappings" },
  { key: "requests", label: "Demandes", href: "/admin/alibaba-sourcing/requests" },
  { key: "lots", label: "Lots d'achat", href: "/admin/alibaba-sourcing/lots" },
  { key: "receptions", label: "Receptions", href: "/admin/alibaba-sourcing/receptions" },
];

export function AdminAlibabaOperationsClient({ initialDashboard }: Props) {
  const router = useRouter();
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
    authorizeUrl: "https://openapi-auth.alibaba.com/oauth/authorize",
    tokenUrl: "https://openapi-api.alibaba.com/rest/auth/token/create",
    refreshUrl: "https://openapi-api.alibaba.com/rest/auth/token/refresh",
    apiBaseUrl: "https://openapi-api.alibaba.com",
    accountPlatform: "buyer",
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
  const activeSupplierAccount = useMemo(() => initialDashboard.supplierAccounts.find((account) => account.isActive && account.status === "connected") ?? initialDashboard.supplierAccounts.find((account) => account.status === "connected") ?? null, [initialDashboard.supplierAccounts]);

  const refresh = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  const runImport = async () => {
    setFeedback(null);
    if (!activeSupplierAccount) {
      setFeedback("Connecte d'abord un compte Alibaba actif pour lancer l'import live.");
      return;
    }
    const response = await fetch("/api/admin/alibaba/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(importForm),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setFeedback(payload?.message ?? "Import Alibaba impossible.");
      return;
    }
    setFeedback("Import Alibaba live termine et catalogue mis a jour.");
    refresh();
  };

  const publishSelection = async () => {
    if (selectedProductIds.length === 0) {
      setFeedback("Selectionne au moins un article a publier.");
      return;
    }

    const response = await fetch("/api/admin/alibaba/publish", {
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
    const response = await fetch("/api/admin/alibaba/purchase-orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        importedProductId,
        quantity: quantityByProduct[importedProductId] ?? 1,
        shippingAddressId: defaultAddressId,
        autoPay: true,
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setFeedback(payload?.message ?? "Creation du lot d'achat impossible.");
      return;
    }

    setFeedback("Lot d'achat cree. Paiement/URL Alibaba prepare.");
    refresh();
  };

  const payOrder = async (orderId: string, action: "pay" | "refresh") => {
    const response = await fetch(`/api/admin/alibaba/purchase-orders/${orderId}/pay`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });

    if (!response.ok) {
      setFeedback(action === "pay" ? "Paiement Alibaba impossible." : "Actualisation paiement impossible.");
      return;
    }

    setFeedback(action === "pay" ? "Paiement Alibaba lance." : "Statut paiement actualise.");
    refresh();
  };

  const saveAccount = async () => {
    const response = await fetch("/api/admin/alibaba/supplier-accounts", {
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
      authorizeUrl: "https://openapi-auth.alibaba.com/oauth/authorize",
      tokenUrl: "https://openapi-api.alibaba.com/rest/auth/token/create",
      refreshUrl: "https://openapi-api.alibaba.com/rest/auth/token/refresh",
      apiBaseUrl: "https://openapi-api.alibaba.com",
      accountPlatform: "buyer",
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
    const response = await fetch("/api/admin/alibaba/supplier-accounts/oauth/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...accountForm,
        origin: window.location.origin,
      }),
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload?.authorizeUrl) {
      setFeedback(payload?.message ?? "Impossible de generer l'URL d'autorisation Alibaba.");
      return;
    }

    window.location.assign(String(payload.authorizeUrl));
  };

  const refreshAccountToken = async (accountId: string) => {
    setFeedback(null);
    const response = await fetch(`/api/admin/alibaba/supplier-accounts/${accountId}/refresh`, {
      method: "POST",
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setFeedback(payload?.message ?? "Refresh du token Alibaba impossible.");
      return;
    }

    setFeedback("Token Alibaba rafraichi.");
    refresh();
  };

  const connectExistingAccount = async (accountId: string) => {
    setFeedback(null);
    const response = await fetch("/api/admin/alibaba/supplier-accounts/oauth/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: accountId,
        origin: window.location.origin,
      }),
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload?.authorizeUrl) {
      setFeedback(payload?.message ?? "Impossible de lancer l'autorisation pour ce compte.");
      return;
    }

    window.location.assign(String(payload.authorizeUrl));
  };

  const saveAddress = async () => {
    const response = await fetch("/api/admin/alibaba/reception-addresses", {
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
    const response = await fetch("/api/admin/alibaba/country-profiles", {
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
            <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#ff6a3d]">Alibaba automation</div>
            <h1 className="mt-2 text-[32px] font-black tracking-[-0.05em] text-[#1f2937]">Import catalogue, achats et paiements Alibaba</h1>
            <p className="mt-3 text-[14px] leading-7 text-[#667085]">
              Recherche par mot-cle, import massif jusqu&apos;a 100 articles, recuperation images/videos, publication catalogue site,
              creation automatique BuyNow order et orchestration du paiement Alibaba depuis le back-office.
            </p>
            <div className="mt-4 inline-flex flex-wrap items-center gap-2 rounded-[16px] bg-white px-4 py-3 text-[13px] text-[#475467] shadow-[0_8px_18px_rgba(17,24,39,0.05)]">
              <span className="font-semibold text-[#1f2937]">Compte actif:</span>
              <span>{activeSupplierAccount ? `${activeSupplierAccount.name} · ${activeSupplierAccount.accountLogin ?? activeSupplierAccount.email}` : "aucun compte connecte"}</span>
            </div>
            {feedback ? <div className="mt-4 rounded-[16px] bg-white px-4 py-3 text-[13px] font-semibold text-[#1f2937] shadow-[0_8px_18px_rgba(17,24,39,0.05)]">{feedback}</div> : null}
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
          { label: "Articles importes", value: String(initialDashboard.stats.importedCount), icon: Package2, accent: "bg-[#fff1e8] text-[#ff6a00]" },
          { label: "Publies sur le site", value: String(initialDashboard.stats.publishedCount), icon: CheckCircle2, accent: "bg-[#eafaf0] text-[#16a34a]" },
          { label: "Paiements en attente", value: String(initialDashboard.stats.pendingPayments), icon: Wallet, accent: "bg-[#eef4ff] text-[#2f67f6]" },
          { label: "Ordres payes", value: String(initialDashboard.stats.paidOrders), icon: Building2, accent: "bg-[#f5efff] text-[#7c3aed]" },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <article key={card.label} className="rounded-[18px] border border-[#e6eaf0] bg-white px-5 py-5 shadow-[0_8px_22px_rgba(17,24,39,0.05)]">
              <div className={`inline-flex h-11 w-11 items-center justify-center rounded-[14px] ${card.accent}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="mt-4 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">{card.label}</div>
              <div className="mt-1 text-[24px] font-black tracking-[-0.05em] text-[#1f2937]">{card.value}</div>
            </article>
          );
        })}
      </section>

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
                      <div className="mt-1 text-[13px] text-[#667085]">{job.importedCount} produits · limite {job.limit} · {job.fulfillmentChannel}</div>
                    </div>
                    <div className="rounded-full bg-[#fff7ed] px-3 py-1 text-[12px] font-semibold text-[#c2410c]">{job.status}</div>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-[20px] border border-[#e6eaf0] bg-white p-5 shadow-[0_8px_22px_rgba(17,24,39,0.05)]">
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#ff6a5b]">Achats Alibaba</div>
            <div className="mt-2 text-[22px] font-black tracking-[-0.04em] text-[#1f2937]">Commandes, pay_url et paiements</div>
            <div className="mt-4 space-y-3">
              {recentOrders.length === 0 ? <div className="rounded-[16px] bg-[#f8fafc] px-4 py-4 text-[13px] text-[#667085]">Aucun lot d&apos;achat cree pour le moment.</div> : recentOrders.map((order) => (
                <div key={order.id} className="rounded-[16px] border border-[#edf1f6] px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[15px] font-semibold text-[#1f2937]">{order.productTitle}</div>
                      <div className="mt-1 text-[13px] text-[#667085]">{order.quantity} unites · {order.supplierName}</div>
                      {order.payUrl ? <a href={order.payUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-[12px] font-semibold text-[#2f67f6]">Ouvrir pay_url Alibaba</a> : null}
                    </div>
                    <div className="text-right">
                      <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#98a2b3]">{order.paymentStatus}</div>
                      <div className="mt-1 text-[14px] font-semibold text-[#1f2937]">${order.amountUsd.toFixed(2)}</div>
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
            <div className="mt-2 text-[22px] font-black tracking-[-0.04em] text-[#1f2937]">Recherche Alibaba par mot-cle</div>
            <div className="mt-3 rounded-[14px] bg-[#f8fafc] px-4 py-3 text-[13px] text-[#667085]">
              {activeSupplierAccount
                ? `Import live via ${activeSupplierAccount.name} (${activeSupplierAccount.accountLogin ?? activeSupplierAccount.email}).`
                : "Aucun compte Alibaba connecte. Autorise un compte dans l'onglet Comptes fournisseurs avant l'import."}
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="text-[13px] font-semibold text-[#344054] sm:col-span-2">
                Mot-cle
                <input value={importForm.query} onChange={(event) => setImportForm((current) => ({ ...current, query: event.target.value }))} placeholder="Anneau, bague, piercing, souris..." className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] text-[#111827] outline-none focus:border-[#ff6a00]" />
              </label>
              <label className="text-[13px] font-semibold text-[#344054]">
                Nombre a importer
                <input value={importForm.limit} onChange={(event) => setImportForm((current) => ({ ...current, limit: Number(event.target.value) }))} type="number" min={1} max={100} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] text-[#111827] outline-none focus:border-[#ff6a00]" />
              </label>
              <label className="text-[13px] font-semibold text-[#344054]">
                Pool Alibaba
                <select value={importForm.fulfillmentChannel} onChange={(event) => setImportForm((current) => ({ ...current, fulfillmentChannel: event.target.value }))} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] text-[#111827] outline-none focus:border-[#ff6a00]">
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
              <input checked={importForm.autoPublish} onChange={(event) => setImportForm((current) => ({ ...current, autoPublish: event.target.checked }))} type="checkbox" className="h-4 w-4 rounded border-[#d7dce5] text-[#ff6a00] focus:ring-[#ff6a00]" />
              Publier automatiquement les articles importes sur le site
            </label>
            <div className="mt-5 flex gap-3">
              <button type="button" onClick={runImport} disabled={isPending || !importForm.query.trim() || !activeSupplierAccount} className="inline-flex h-11 items-center justify-center gap-2 rounded-[14px] bg-[#111827] px-5 text-[14px] font-semibold text-white transition hover:bg-[#1f2937] disabled:opacity-60">
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
              <div className="text-[13px] text-[#667085]">{initialDashboard.importedProducts.length} lignes</div>
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
                            <div className="mt-1 text-[13px] text-[#667085]">{product.supplierName} · MOQ {product.moq} {product.unit}</div>
                            <div className="mt-1 text-[12px] text-[#98a2b3]">{product.gallery.length} images · {product.videoUrl ? "video recuperee" : "pas de video"} · stock {product.inventory}</div>
                          </div>
                          <div className="rounded-full bg-[#fff7ed] px-3 py-1 text-[12px] font-semibold text-[#c2410c]">{product.status}</div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-3">
                          <div className="text-[14px] font-bold text-[#111827]">${product.minUsd.toFixed(2)}</div>
                          <input value={quantityByProduct[product.id] ?? product.moq} onChange={(event) => setQuantityByProduct((current) => ({ ...current, [product.id]: Number(event.target.value) }))} type="number" min={1} className="h-10 w-28 rounded-[12px] border border-[#d7dce5] px-3 text-[13px] text-[#111827] outline-none focus:border-[#ff6a00]" />
                          <button type="button" onClick={() => createPurchaseOrder(product.id)} className="inline-flex h-10 items-center justify-center rounded-[12px] bg-[#111827] px-4 text-[13px] font-semibold text-white transition hover:bg-[#1f2937]">Auto achat</button>
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
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#ff6a5b]">Compte Alibaba</div>
            <div className="mt-2 text-[22px] font-black tracking-[-0.04em] text-[#1f2937]">Liaison buyer / seller / ISV</div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="text-[13px] font-semibold text-[#344054] sm:col-span-2">Nom<input value={accountForm.name} onChange={(event) => setAccountForm((current) => ({ ...current, name: event.target.value }))} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] outline-none focus:border-[#ff6a00]" /></label>
              <label className="text-[13px] font-semibold text-[#344054] sm:col-span-2">Email<input value={accountForm.email} onChange={(event) => setAccountForm((current) => ({ ...current, email: event.target.value }))} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] outline-none focus:border-[#ff6a00]" /></label>
              <label className="text-[13px] font-semibold text-[#344054]">Member ID<input value={accountForm.memberId} onChange={(event) => setAccountForm((current) => ({ ...current, memberId: event.target.value }))} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] outline-none focus:border-[#ff6a00]" /></label>
              <label className="text-[13px] font-semibold text-[#344054]">Resource owner<input value={accountForm.resourceOwner} onChange={(event) => setAccountForm((current) => ({ ...current, resourceOwner: event.target.value }))} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] outline-none focus:border-[#ff6a00]" /></label>
              <label className="text-[13px] font-semibold text-[#344054]">App Key<input value={accountForm.appKey} onChange={(event) => setAccountForm((current) => ({ ...current, appKey: event.target.value }))} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] outline-none focus:border-[#ff6a00]" /></label>
              <label className="text-[13px] font-semibold text-[#344054]">App Secret<input value={accountForm.appSecret} onChange={(event) => setAccountForm((current) => ({ ...current, appSecret: event.target.value }))} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] outline-none focus:border-[#ff6a00]" /></label>
              <label className="text-[13px] font-semibold text-[#344054] sm:col-span-2">Authorize URL<input value={accountForm.authorizeUrl} onChange={(event) => setAccountForm((current) => ({ ...current, authorizeUrl: event.target.value }))} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] outline-none focus:border-[#ff6a00]" /></label>
              <label className="text-[13px] font-semibold text-[#344054] sm:col-span-2">Token URL<input value={accountForm.tokenUrl} onChange={(event) => setAccountForm((current) => ({ ...current, tokenUrl: event.target.value }))} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] outline-none focus:border-[#ff6a00]" /></label>
              <label className="text-[13px] font-semibold text-[#344054] sm:col-span-2">Refresh URL<input value={accountForm.refreshUrl} onChange={(event) => setAccountForm((current) => ({ ...current, refreshUrl: event.target.value }))} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] outline-none focus:border-[#ff6a00]" /></label>
              <label className="text-[13px] font-semibold text-[#344054] sm:col-span-2">API Base URL<input value={accountForm.apiBaseUrl} onChange={(event) => setAccountForm((current) => ({ ...current, apiBaseUrl: event.target.value }))} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] outline-none focus:border-[#ff6a00]" /></label>
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
              <button type="button" onClick={startOAuthAuthorization} disabled={!accountForm.appKey || !accountForm.appSecret} className="inline-flex h-11 items-center justify-center rounded-[14px] border border-[#dbe2ea] bg-white px-5 text-[14px] font-semibold text-[#1f2937] transition hover:border-[#ff6a00] hover:text-[#ff6a00] disabled:opacity-60">Autoriser OAuth</button>
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
                      <div className="mt-1 text-[12px] text-[#98a2b3]">{account.accountLogin ?? "non autorise"} · token {account.hasAccessToken ? "present" : "absent"} · refresh {account.hasRefreshToken ? "present" : "absent"}</div>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {account.isActive ? <div className="rounded-full bg-[#eafaf0] px-3 py-1 text-[12px] font-semibold text-[#15803d]">Actif</div> : null}
                      <div className="rounded-full bg-[#fff7ed] px-3 py-1 text-[12px] font-semibold text-[#c2410c]">{account.status}</div>
                      <button type="button" onClick={() => setAccountForm({
                        id: account.id,
                        name: account.name,
                        email: account.email,
                        memberId: account.memberId ?? "",
                        resourceOwner: account.resourceOwner ?? "",
                        appKey: account.appKey ?? "",
                        appSecret: "",
                        authorizeUrl: account.authorizeUrl ?? "https://openapi-auth.alibaba.com/oauth/authorize",
                        tokenUrl: account.tokenUrl ?? "https://openapi-api.alibaba.com/rest/auth/token/create",
                        refreshUrl: account.refreshUrl ?? "https://openapi-api.alibaba.com/rest/auth/token/refresh",
                        apiBaseUrl: account.apiBaseUrl ?? "https://openapi-api.alibaba.com",
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
          <div className="mt-2 text-[22px] font-black tracking-[-0.04em] text-[#1f2937]">Correspondance produit site et source Alibaba</div>
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
          <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#ff6a5b]">Lots d&apos;achat</div>
          <div className="mt-2 text-[22px] font-black tracking-[-0.04em] text-[#1f2937]">BuyNow orders, pay_url et suivi paiement</div>
          <div className="mt-5 space-y-3">
            {initialDashboard.purchaseOrders.length === 0 ? <div className="rounded-[16px] bg-[#f8fafc] px-4 py-4 text-[13px] text-[#667085]">Aucun lot d&apos;achat Alibaba.</div> : initialDashboard.purchaseOrders.map((order) => (
              <div key={order.id} className="rounded-[16px] border border-[#edf1f6] p-4">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div>
                    <div className="text-[16px] font-semibold text-[#1f2937]">{order.productTitle}</div>
                    <div className="mt-1 text-[13px] text-[#667085]">trade_id: {order.tradeId ?? "non retourne"} · {order.quantity} unites · {order.supplierName}</div>
                    <div className="mt-1 text-[13px] text-[#667085]">Etat ordre: {order.orderStatus} · paiement: {order.paymentStatus}</div>
                    {order.payFailureReason ? <div className="mt-1 text-[12px] font-semibold text-[#b42318]">{order.payFailureReason}</div> : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="rounded-[12px] bg-[#fff7ed] px-3 py-2 text-[13px] font-semibold text-[#c2410c]">${order.amountUsd.toFixed(2)}</div>
                    {order.payUrl ? <a href={order.payUrl} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center rounded-[12px] border border-[#dbe2ea] px-4 text-[13px] font-semibold text-[#1f2937] transition hover:border-[#ff6a00] hover:text-[#ff6a00]">pay_url</a> : null}
                    <button type="button" onClick={() => payOrder(order.id, "pay")} className="inline-flex h-10 items-center justify-center gap-2 rounded-[12px] bg-[#111827] px-4 text-[13px] font-semibold text-white transition hover:bg-[#1f2937]"><Wallet className="h-4 w-4" />Payer</button>
                    <button type="button" onClick={() => payOrder(order.id, "refresh")} className="inline-flex h-10 items-center justify-center gap-2 rounded-[12px] border border-[#dbe2ea] px-4 text-[13px] font-semibold text-[#1f2937] transition hover:border-[#ff6a00] hover:text-[#ff6a00]"><RefreshCcw className="h-4 w-4" />Actualiser</button>
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
                    <td className="py-3.5 pr-4">{reception.quantityExpected}</td>
                    <td className="py-3.5 pr-4">{reception.quantityReceived}</td>
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
            { title: "Comptes fournisseurs", value: String(initialDashboard.supplierAccounts.length), icon: Building2, href: "/admin/alibaba-sourcing/accounts" },
            { title: "Pays actifs", value: String(initialDashboard.countries.filter((item) => item.enabled).length), icon: Globe2, href: "/admin/alibaba-sourcing/countries" },
            { title: "Adresses reception", value: String(initialDashboard.addresses.length), icon: MapPin, href: "/admin/alibaba-sourcing/addresses" },
            { title: "Produits recents", value: String(recentImports.length), icon: Package2, href: "/admin/alibaba-sourcing/import-catalog" },
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
