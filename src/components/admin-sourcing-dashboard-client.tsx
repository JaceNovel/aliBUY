"use client";

import Link from "next/link";
import { ArrowUpRight, Calculator, Percent, Save, Ship, Truck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import {
  AIR_BATCH_TARGET_KG,
  SEA_BATCH_TARGET_CBM,
  formatFcfa,
  getSourcingAlibabaPayUrls,
  getSourcingAlibabaPaymentRollup,
  getSourcingAlibabaPostPaymentAutomationState,
  getSourcingOrderBatchMode,
  getSourcingOrderMeta,
  isSourcingOrderClientPaid,
  isSourcingOrderEligibleForSupplierPayment,
  type SourcingOrder,
  type SourcingSeaContainer,
  type SourcingSettings,
} from "@/lib/alibaba-sourcing";

type CatalogPreviewItem = {
  slug: string;
  title: string;
  weightKg: number;
  volumeCbm: number;
  supplierPriceFcfa: number;
  suggestedFinalPriceFcfa: number;
};

type AdminSourcingDashboardClientProps = {
  initialDashboard: {
    settings: SourcingSettings;
    orders: SourcingOrder[];
    containers: SourcingSeaContainer[];
    catalog: CatalogPreviewItem[];
  };
};

export function AdminSourcingDashboardClient({ initialDashboard }: AdminSourcingDashboardClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [settings, setSettings] = useState(initialDashboard.settings);

  const paidOrders = useMemo(() => initialDashboard.orders.filter((order) => isSourcingOrderClientPaid(order)), [initialDashboard.orders]);
  const paidAirOrders = useMemo(() => paidOrders.filter((order) => getSourcingOrderBatchMode(order) === "air"), [paidOrders]);
  const paidSeaOrders = useMemo(() => paidOrders.filter((order) => getSourcingOrderBatchMode(order) === "sea"), [paidOrders]);
  const eligibleOrders = useMemo(() => initialDashboard.orders.filter((order) => isSourcingOrderEligibleForSupplierPayment(order)), [initialDashboard.orders]);
  const airBatchOrders = useMemo(() => eligibleOrders.filter((order) => getSourcingOrderBatchMode(order) === "air"), [eligibleOrders]);
  const seaBatchOrders = useMemo(() => eligibleOrders.filter((order) => getSourcingOrderBatchMode(order) === "sea"), [eligibleOrders]);
  const blockedPaidOrders = useMemo(() => paidOrders.filter((order) => !isSourcingOrderEligibleForSupplierPayment(order) && getSourcingOrderBatchMode(order) !== null), [paidOrders]);
  const blockedAirOrders = useMemo(() => blockedPaidOrders.filter((order) => getSourcingOrderBatchMode(order) === "air"), [blockedPaidOrders]);
  const blockedSeaOrders = useMemo(() => blockedPaidOrders.filter((order) => getSourcingOrderBatchMode(order) === "sea"), [blockedPaidOrders]);
  const paidAirWeight = useMemo(() => Number(paidAirOrders.reduce((total, order) => total + order.totalWeightKg, 0).toFixed(3)), [paidAirOrders]);
  const paidSeaCbm = useMemo(() => Number(paidSeaOrders.reduce((total, order) => total + order.totalVolumeCbm, 0).toFixed(4)), [paidSeaOrders]);
  const airBatchWeight = useMemo(() => Number(airBatchOrders.reduce((total, order) => total + order.totalWeightKg, 0).toFixed(3)), [airBatchOrders]);
  const seaBatchCbm = useMemo(() => Number(seaBatchOrders.reduce((total, order) => total + order.totalVolumeCbm, 0).toFixed(4)), [seaBatchOrders]);

  const getBlockedReason = (order: SourcingOrder) => {
    if (order.supplierOrderStatus === "failed") {
      return "Création fournisseur échouée";
    }

    if (order.supplierOrderStatus === "not_created") {
      return "Commande fournisseur non créée";
    }

    if (order.supplierOrderStatus === "skipped") {
      return "Flux fournisseur ignoré après vérification fret";
    }

    if (order.alibabaTradeIds.length === 0) {
      return "Aucun trade Alibaba disponible";
    }

    if (getSourcingAlibabaPaymentRollup(order) === "paid") {
      return "Déjà payé côté fournisseur";
    }

    return "Bloquée avant lancement fournisseur";
  };

  const launchBatch = async (mode: "air" | "sea") => {
    setFeedback(null);

    const response = await fetch(`/api/admin/sourcing/batches/${mode}/launch`, {
      method: "POST",
    });
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      setFeedback(data?.message || "Impossible de lancer ce lot fournisseur.");
      return;
    }

    setFeedback(`Lot ${mode === "air" ? "avion" : "maritime"} lancé. ${String(data?.processedCount ?? 0)} commande(s) traitée(s).`);
    startTransition(() => {
      router.refresh();
    });
  };

  const launchOrder = async (orderId: string) => {
    setFeedback(null);

    const response = await fetch(`/api/admin/sourcing/orders/${encodeURIComponent(orderId)}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ action: "launch-supplier-payment" }),
    });
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      setFeedback(data?.message || "Impossible de lancer cette commande fournisseur.");
      return;
    }

    setFeedback(`Commande fournisseur lancée pour ${String(data?.order?.orderNumber ?? orderId)}.`);
    startTransition(() => {
      router.refresh();
    });
  };

  const persistSettings = async () => {
    setFeedback(null);

    const response = await fetch("/api/admin/sourcing/settings", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(settings),
    });

    if (!response.ok) {
      setFeedback("Impossible d'enregistrer les réglages sourcing.");
      return;
    }

    setFeedback("Réglages sourcing enregistrés.");
    startTransition(() => {
      router.refresh();
    });
  };

  const triggerContainer = async (containerId: string) => {
    setFeedback(null);

    const response = await fetch(`/api/admin/sourcing/containers/${containerId}/trigger`, {
      method: "POST",
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      setFeedback(payload?.message || "Impossible de déclencher ce conteneur.");
      return;
    }

    setFeedback("Conteneur maritime déclenché. Les commandes de ce conteneur passent en statut Transport lance.");
    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <div className="space-y-5">
      <section className="rounded-[24px] border border-[#e6eaf0] bg-[linear-gradient(135deg,#fff5ef_0%,#ffffff_45%,#eef5ff_100%)] px-5 py-6 shadow-[0_8px_22px_rgba(17,24,39,0.05)] sm:px-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-[860px]">
            <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#ff6a3d]">Admin sourcing</div>
            <h1 className="mt-2 text-[32px] font-black tracking-[-0.05em] text-[#1f2937]">Alibaba Sourcing</h1>
            <p className="mt-3 text-[14px] leading-7 text-[#667085]">Les réglages de fret, de marge et de groupage sont maintenant persistés côté serveur. Le checkout client et la création de commande fournisseur Alibaba lisent cette même source.</p>
            {feedback ? <div className="mt-4 rounded-[16px] bg-white px-4 py-3 text-[13px] font-semibold text-[#1f2937] shadow-[0_8px_18px_rgba(17,24,39,0.05)]">{feedback}</div> : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 xl:min-w-[300px]">
            <Link href="/admin/imports/239826786001021591" className="inline-flex h-12 items-center justify-center gap-2 rounded-[16px] bg-[#ff6a00] px-5 text-[14px] font-semibold text-white transition hover:bg-[#e55e00]">
              Ouvrir le cockpit API Alibaba
              <ArrowUpRight className="h-4 w-4" />
            </Link>
            <Link href="/checkout" className="inline-flex h-12 items-center justify-center gap-2 rounded-[16px] border border-[#dbe2ea] bg-white px-5 text-[14px] font-semibold text-[#1f2937] transition hover:border-[#ff6a00] hover:text-[#ff6a00]">
              Ouvrir le checkout sourcing
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Marge site", value: settings.defaultMarginMode === "fixed" ? `${formatFcfa(settings.defaultMarginValue)} / unité` : `${settings.defaultMarginValue}%`, icon: Percent, accent: "bg-[#fff1e8] text-[#ff6a00]" },
          { label: "Avion", value: `${formatFcfa(settings.airRatePerKgFcfa)}/kg`, icon: Truck, accent: "bg-[#eef4ff] text-[#2f67f6]" },
          { label: "Bateau", value: `${formatFcfa(settings.seaSellRatePerCbmFcfa)}/CBM`, icon: Ship, accent: "bg-[#eafaf0] text-[#16a34a]" },
          { label: "Livraison offerte", value: formatFcfa(settings.freeAirThresholdFcfa), icon: Calculator, accent: "bg-[#f5efff] text-[#7c3aed]" },
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

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-[20px] border border-[#e6eaf0] bg-white p-5 shadow-[0_8px_22px_rgba(17,24,39,0.05)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#ff6a5b]">Batch avion</div>
              <div className="mt-2 text-[22px] font-black tracking-[-0.04em] text-[#1f2937]">Regroupement fournisseur à 2 kg</div>
              <div className="mt-2 text-[13px] leading-6 text-[#667085]">Les commandes payées restent en file d&apos;attente jusqu&apos;au lancement admin. Le lot peut aussi être déclenché avant le seuil.</div>
              {blockedAirOrders.length > 0 ? <div className="mt-2 text-[12px] font-semibold text-[#b54708]">{blockedAirOrders.length} commande(s) payée(s) avion sont bloquées avant le lot.</div> : null}
            </div>
            <button type="button" onClick={() => launchBatch("air")} disabled={isPending || airBatchOrders.length === 0} className="inline-flex h-11 items-center justify-center rounded-[14px] bg-[#111827] px-5 text-[14px] font-semibold text-white transition hover:bg-[#1f2937] disabled:cursor-not-allowed disabled:opacity-60">
              {airBatchWeight >= AIR_BATCH_TARGET_KG ? "Lancer le lot" : "Lancer quand même"}
            </button>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[16px] bg-[#fafbfd] px-4 py-4 ring-1 ring-[#edf1f6]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#98a2b3]">Poids cumulé</div>
              <div className="mt-1 text-[22px] font-black tracking-[-0.05em] text-[#1f2937]">{paidAirWeight.toFixed(3)} kg</div>
              <div className="mt-1 text-[12px] text-[#667085]">{airBatchWeight.toFixed(3)} kg lançables</div>
            </div>
            <div className="rounded-[16px] bg-[#fafbfd] px-4 py-4 ring-1 ring-[#edf1f6]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#98a2b3]">Seuil</div>
              <div className="mt-1 text-[22px] font-black tracking-[-0.05em] text-[#1f2937]">{AIR_BATCH_TARGET_KG.toFixed(0)} kg</div>
            </div>
            <div className="rounded-[16px] bg-[#fafbfd] px-4 py-4 ring-1 ring-[#edf1f6]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#98a2b3]">Commandes</div>
              <div className="mt-1 text-[22px] font-black tracking-[-0.05em] text-[#1f2937]">{paidAirOrders.length}</div>
              <div className="mt-1 text-[12px] text-[#667085]">{airBatchOrders.length} lançables</div>
            </div>
          </div>
        </article>

        <article className="rounded-[20px] border border-[#e6eaf0] bg-white p-5 shadow-[0_8px_22px_rgba(17,24,39,0.05)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#ff6a5b]">Batch maritime</div>
              <div className="mt-2 text-[22px] font-black tracking-[-0.04em] text-[#1f2937]">Regroupement fournisseur à 1 CBM</div>
              <div className="mt-2 text-[13px] leading-6 text-[#667085]">Inclut les commandes mer et toutes les commandes de la campagne articles gratuits, forcées en maritime.</div>
              {blockedSeaOrders.length > 0 ? <div className="mt-2 text-[12px] font-semibold text-[#b54708]">{blockedSeaOrders.length} commande(s) payée(s) mer sont bloquées avant le lot.</div> : null}
            </div>
            <button type="button" onClick={() => launchBatch("sea")} disabled={isPending || seaBatchOrders.length === 0} className="inline-flex h-11 items-center justify-center rounded-[14px] bg-[#111827] px-5 text-[14px] font-semibold text-white transition hover:bg-[#1f2937] disabled:cursor-not-allowed disabled:opacity-60">
              {seaBatchCbm >= SEA_BATCH_TARGET_CBM ? "Lancer le lot" : "Lancer quand même"}
            </button>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[16px] bg-[#fafbfd] px-4 py-4 ring-1 ring-[#edf1f6]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#98a2b3]">Volume cumulé</div>
              <div className="mt-1 text-[22px] font-black tracking-[-0.05em] text-[#1f2937]">{paidSeaCbm.toFixed(4)} CBM</div>
              <div className="mt-1 text-[12px] text-[#667085]">{seaBatchCbm.toFixed(4)} CBM lançables</div>
            </div>
            <div className="rounded-[16px] bg-[#fafbfd] px-4 py-4 ring-1 ring-[#edf1f6]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#98a2b3]">Seuil</div>
              <div className="mt-1 text-[22px] font-black tracking-[-0.05em] text-[#1f2937]">{SEA_BATCH_TARGET_CBM.toFixed(0)} CBM</div>
            </div>
            <div className="rounded-[16px] bg-[#fafbfd] px-4 py-4 ring-1 ring-[#edf1f6]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#98a2b3]">Commandes</div>
              <div className="mt-1 text-[22px] font-black tracking-[-0.05em] text-[#1f2937]">{paidSeaOrders.length}</div>
              <div className="mt-1 text-[12px] text-[#667085]">{seaBatchOrders.length} lançables</div>
            </div>
          </div>
        </article>
      </section>

      {blockedPaidOrders.length > 0 ? (
        <section className="rounded-[20px] border border-[#f3d7c2] bg-[#fffaf6] p-5 shadow-[0_8px_22px_rgba(17,24,39,0.05)]">
          <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#d85300]">Blocages avant lot</div>
          <div className="mt-2 text-[22px] font-black tracking-[-0.04em] text-[#1f2937]">Commandes payées non lançables</div>
          <div className="mt-2 text-[13px] leading-6 text-[#667085]">Ces commandes sont déjà payées par le client, mais elles ne peuvent pas encore entrer dans le lancement fournisseur Alibaba.</div>
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-left">
              <thead>
                <tr className="text-[12px] uppercase tracking-[0.08em] text-[#98a2b3]">
                  <th className="py-3 pr-4 font-semibold">Commande</th>
                  <th className="py-3 pr-4 font-semibold">Client</th>
                  <th className="py-3 pr-4 font-semibold">File</th>
                  <th className="py-3 pr-4 font-semibold">Poids / CBM</th>
                  <th className="py-3 pr-4 font-semibold">Blocage</th>
                  <th className="py-3 pr-4 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {blockedPaidOrders.map((order) => {
                  const batchMode = getSourcingOrderBatchMode(order);

                  return (
                    <tr key={`blocked-${order.id}`} className="border-t border-[#f2e8df] text-[13px] text-[#1f2937]">
                      <td className="py-3.5 pr-4 font-semibold"><Link href={`/admin/orders/${encodeURIComponent(order.id)}`} className="transition hover:text-[#ff6a00]">{order.orderNumber}</Link></td>
                      <td className="py-3.5 pr-4">{order.customerName}</td>
                      <td className="py-3.5 pr-4">{batchMode === "air" ? "Lot avion" : "Lot mer"}</td>
                      <td className="py-3.5 pr-4">{order.totalWeightKg.toFixed(3)} kg · {order.totalVolumeCbm.toFixed(4)} CBM</td>
                      <td className="py-3.5 pr-4 text-[#b54708]">{getBlockedReason(order)}</td>
                      <td className="py-3.5 pr-4"><Link href={`/admin/orders/${encodeURIComponent(order.id)}`} className="font-semibold text-[#ff6a00] transition hover:opacity-80">Ouvrir</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
        <article className="rounded-[20px] border border-[#e6eaf0] bg-white p-5 shadow-[0_8px_22px_rgba(17,24,39,0.05)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#ff6a5b]">Réglages persistés</div>
              <div className="mt-2 text-[22px] font-black tracking-[-0.04em] text-[#1f2937]">Pricing engine et logistique</div>
            </div>
            <button type="button" onClick={persistSettings} disabled={isPending} className="inline-flex h-11 items-center justify-center gap-2 rounded-[14px] bg-[#111827] px-5 text-[14px] font-semibold text-white transition hover:bg-[#1f2937] disabled:cursor-not-allowed disabled:opacity-70">
              <Save className="h-4 w-4" />
              Enregistrer
            </button>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="text-[13px] font-semibold text-[#344054]">
              Taux avion / kg
              <input value={settings.airRatePerKgFcfa} onChange={(event) => setSettings((current) => ({ ...current, airRatePerKgFcfa: Number(event.target.value) }))} type="number" className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] text-[#111827] outline-none focus:border-[#ff6a00]" />
            </label>
            <label className="text-[13px] font-semibold text-[#344054]">
              Délai avion
              <input value={settings.airEstimatedDays} onChange={(event) => setSettings((current) => ({ ...current, airEstimatedDays: event.target.value }))} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] text-[#111827] outline-none focus:border-[#ff6a00]" />
            </label>
            <label className="text-[13px] font-semibold text-[#344054]">
              Coût réel mer / CBM
              <input value={settings.seaRealCostPerCbmFcfa} onChange={(event) => setSettings((current) => ({ ...current, seaRealCostPerCbmFcfa: Number(event.target.value) }))} type="number" className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] text-[#111827] outline-none focus:border-[#ff6a00]" />
            </label>
            <label className="text-[13px] font-semibold text-[#344054]">
              Prix vente mer / CBM
              <input value={settings.seaSellRatePerCbmFcfa} onChange={(event) => setSettings((current) => ({ ...current, seaSellRatePerCbmFcfa: Number(event.target.value) }))} type="number" className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] text-[#111827] outline-none focus:border-[#ff6a00]" />
            </label>
            <label className="text-[13px] font-semibold text-[#344054]">
              Délai mer
              <input value={settings.seaEstimatedDays} onChange={(event) => setSettings((current) => ({ ...current, seaEstimatedDays: event.target.value }))} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] text-[#111827] outline-none focus:border-[#ff6a00]" />
            </label>
            <label className="text-[13px] font-semibold text-[#344054]">
              Seuil livraison offerte
              <input value={settings.freeAirThresholdFcfa} onChange={(event) => setSettings((current) => ({ ...current, freeAirThresholdFcfa: Number(event.target.value) }))} type="number" className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] text-[#111827] outline-none focus:border-[#ff6a00]" />
            </label>
            <label className="text-[13px] font-semibold text-[#344054]">
              Seuil poids avion
              <input value={settings.airWeightThresholdKg} onChange={(event) => setSettings((current) => ({ ...current, airWeightThresholdKg: Number(event.target.value) }))} type="number" step="0.1" className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] text-[#111827] outline-none focus:border-[#ff6a00]" />
            </label>
            <label className="text-[13px] font-semibold text-[#344054]">
              Taille container CBM
              <input value={settings.containerTargetCbm} onChange={(event) => setSettings((current) => ({ ...current, containerTargetCbm: Number(event.target.value) }))} type="number" step="0.0001" className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] text-[#111827] outline-none focus:border-[#ff6a00]" />
            </label>
            <label className="text-[13px] font-semibold text-[#344054]">
              Mode marge
              <select value={settings.defaultMarginMode} onChange={(event) => setSettings((current) => ({ ...current, defaultMarginMode: event.target.value === "fixed" ? "fixed" : "percent" }))} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] text-[#111827] outline-none focus:border-[#ff6a00]">
                <option value="percent">Pourcentage</option>
                <option value="fixed">Fixe FCFA</option>
              </select>
            </label>
            <label className="text-[13px] font-semibold text-[#344054]">
              Valeur marge
              <input value={settings.defaultMarginValue} onChange={(event) => setSettings((current) => ({ ...current, defaultMarginValue: Number(event.target.value) }))} type="number" step="0.01" className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] text-[#111827] outline-none focus:border-[#ff6a00]" />
            </label>
          </div>

          <label className="mt-4 inline-flex items-center gap-3 text-[13px] font-semibold text-[#344054]">
            <input checked={settings.freeAirEnabled} onChange={(event) => setSettings((current) => ({ ...current, freeAirEnabled: event.target.checked }))} type="checkbox" className="h-4 w-4 rounded border-[#d7dce5] text-[#ff6a00] focus:ring-[#ff6a00]" />
            Activer la livraison avion offerte au-dessus du seuil
          </label>
        </article>

        <article className="rounded-[20px] border border-[#e6eaf0] bg-white p-5 shadow-[0_8px_22px_rgba(17,24,39,0.05)]">
          <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#ff6a5b]">Catalogue fournisseur</div>
          <div className="mt-2 text-[22px] font-black tracking-[-0.04em] text-[#1f2937]">Prix fournisseur et prix final site</div>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-left">
              <thead>
                <tr className="text-[12px] uppercase tracking-[0.08em] text-[#98a2b3]">
                  <th className="py-3 pr-4 font-semibold">Produit</th>
                  <th className="py-3 pr-4 font-semibold">Poids</th>
                  <th className="py-3 pr-4 font-semibold">CBM</th>
                  <th className="py-3 pr-4 font-semibold">Fournisseur</th>
                  <th className="py-3 pr-4 font-semibold">Prix final</th>
                </tr>
              </thead>
              <tbody>
                {initialDashboard.catalog.map((item) => (
                  <tr key={item.slug} className="border-t border-[#edf1f6] text-[13px] text-[#1f2937]">
                    <td className="py-3.5 pr-4 font-semibold">{item.title}</td>
                    <td className="py-3.5 pr-4">{item.weightKg.toFixed(2)} kg</td>
                    <td className="py-3.5 pr-4">{item.volumeCbm.toFixed(4)} CBM</td>
                    <td className="py-3.5 pr-4">{formatFcfa(item.supplierPriceFcfa)}</td>
                    <td className="py-3.5 pr-4">{formatFcfa(item.suggestedFinalPriceFcfa)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.82fr_1.18fr]">
        <article className="rounded-[20px] border border-[#e6eaf0] bg-white p-5 shadow-[0_8px_22px_rgba(17,24,39,0.05)]">
          <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#ff6a5b]">Conteneurs mer</div>
          <div className="mt-2 text-[22px] font-black tracking-[-0.04em] text-[#1f2937]">Groupage et déclenchement</div>
          <div className="mt-4 space-y-3">
            {initialDashboard.containers.length === 0 ? (
              <div className="rounded-[16px] bg-[#f8fafc] px-4 py-4 text-[13px] text-[#667085]">Aucun conteneur n&apos;est encore alimenté.</div>
            ) : initialDashboard.containers.map((container) => {
              const containerOrders = initialDashboard.orders.filter((order) => order.containerId === container.id);
              const shipmentTriggeredCount = containerOrders.filter((order) => order.status === "shipment_triggered").length;

              return (
                <div key={container.id} className="rounded-[16px] border border-[#edf1f6] px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[15px] font-semibold text-[#1f2937]">{container.code}</div>
                      <div className="mt-1 text-[13px] text-[#667085]">{container.orderCount} commandes · statut {container.status}</div>
                      <div className="mt-1 text-[12px] text-[#98a2b3]">
                        {container.status === "shipped"
                          ? "Deja declenche. Les commandes du conteneur doivent maintenant apparaitre en statut Transport lance."
                          : container.status === "ready_to_ship"
                            ? "Pret au declenchement maritime."
                            : "En cours de remplissage avant declenchement."}
                      </div>
                    </div>
                    <button type="button" onClick={() => triggerContainer(container.id)} disabled={isPending || container.status === "shipped"} className="inline-flex h-10 items-center justify-center rounded-[12px] bg-[#111827] px-4 text-[13px] font-semibold text-white transition hover:bg-[#1f2937] disabled:cursor-not-allowed disabled:opacity-60">
                      {container.status === "shipped" ? "Deja declenche" : "Declencher"}
                    </button>
                  </div>
                  <div className="mt-4 h-3 overflow-hidden rounded-full bg-[#edf1f6]">
                    <div className="h-full rounded-full bg-[linear-gradient(90deg,#2f67f6_0%,#61a7ff_100%)]" style={{ width: `${container.fillPercent}%` }} />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[13px] text-[#667085]">
                    <span>{container.currentCbm.toFixed(4)} / {container.targetCbm.toFixed(4)} CBM</span>
                    <span>{container.fillPercent}% rempli</span>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[14px] bg-[#fafbfd] px-3 py-3 ring-1 ring-[#edf1f6]">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#98a2b3]">Propagation statut</div>
                      <div className="mt-1 text-[18px] font-black tracking-[-0.04em] text-[#1f2937]">{shipmentTriggeredCount}/{containerOrders.length}</div>
                      <div className="mt-1 text-[12px] text-[#667085]">commandes en shipment_triggered</div>
                    </div>
                    <div className="rounded-[14px] bg-[#fafbfd] px-3 py-3 ring-1 ring-[#edf1f6]">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#98a2b3]">Reste à vérifier</div>
                      <div className="mt-1 text-[18px] font-black tracking-[-0.04em] text-[#1f2937]">{Math.max(containerOrders.length - shipmentTriggeredCount, 0)}</div>
                      <div className="mt-1 text-[12px] text-[#667085]">commande(s) non propagée(s)</div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {containerOrders.map((order) => (
                      <Link key={`${container.id}-${order.id}`} href={`/admin/orders/${encodeURIComponent(order.id)}`} className="inline-flex items-center rounded-full border border-[#e4e7ec] bg-[#fafbfd] px-3 py-1 text-[12px] font-semibold text-[#475467] transition hover:border-[#ff6a00] hover:text-[#ff6a00]">
                        {order.orderNumber} · {order.status}
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </article>

        <article className="rounded-[20px] border border-[#e6eaf0] bg-white p-5 shadow-[0_8px_22px_rgba(17,24,39,0.05)]">
          <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#ff6a5b]">Commandes sourcing</div>
          <div className="mt-2 text-[22px] font-black tracking-[-0.04em] text-[#1f2937]">Checkout, freight et supplier orders</div>
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-left">
              <thead>
                <tr className="text-[12px] uppercase tracking-[0.08em] text-[#98a2b3]">
                  <th className="py-3 pr-4 font-semibold">Commande</th>
                  <th className="py-3 pr-4 font-semibold">Client</th>
                  <th className="py-3 pr-4 font-semibold">File</th>
                  <th className="py-3 pr-4 font-semibold">Livraison</th>
                  <th className="py-3 pr-4 font-semibold">Freight</th>
                  <th className="py-3 pr-4 font-semibold">Supplier</th>
                  <th className="py-3 pr-4 font-semibold">Paiement Alibaba</th>
                  <th className="py-3 pr-4 font-semibold">Pay URL</th>
                  <th className="py-3 pr-4 font-semibold">Tracking</th>
                  <th className="py-3 pr-4 font-semibold">Total</th>
                  <th className="py-3 pr-4 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {initialDashboard.orders.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="border-t border-[#edf1f6] py-4 text-[13px] text-[#667085]">Aucune commande sourcing pour le moment.</td>
                  </tr>
                ) : initialDashboard.orders.map((order) => {
                  const automation = getSourcingAlibabaPostPaymentAutomationState(order);
                  const paidTrades = automation?.trades.filter((trade) => trade.paymentResultStatus === "paid").length ?? 0;
                  const trackingTrades = automation?.trades.filter((trade) => trade.tracking.length > 0).length ?? 0;
                  const batchMode = getSourcingOrderBatchMode(order);
                  const paymentRollup = getSourcingAlibabaPaymentRollup(order);
                  const payUrls = getSourcingAlibabaPayUrls(order);
                  const canLaunch = isSourcingOrderEligibleForSupplierPayment(order);
                  const meta = getSourcingOrderMeta(order);

                  return (
                    <tr key={order.id} className="border-t border-[#edf1f6] text-[13px] text-[#1f2937]">
                      <td className="py-3.5 pr-4 font-semibold"><Link href={`/admin/orders/${encodeURIComponent(order.id)}`} className="transition hover:text-[#ff6a00]">{order.orderNumber}</Link></td>
                      <td className="py-3.5 pr-4">{order.customerName}</td>
                      <td className="py-3.5 pr-4">{meta.freeDeal ? "Mer gratuit" : batchMode === "air" ? "Lot avion" : batchMode === "sea" ? "Lot mer" : "Hors lot"}</td>
                      <td className="py-3.5 pr-4">{order.shippingMethod === "sea" ? "Bateau" : order.shippingMethod === "freight" ? "Fret" : "Avion"}</td>
                      <td className="py-3.5 pr-4">{order.freightStatus}</td>
                      <td className="py-3.5 pr-4">{order.supplierOrderStatus}</td>
                      <td className="py-3.5 pr-4">{automation ? `${paidTrades}/${automation.trades.length} payé(s) · ${paymentRollup}` : "Pas encore"}</td>
                      <td className="py-3.5 pr-4">{payUrls.length > 0 ? <Link href={payUrls[0]} target="_blank" className="font-semibold text-[#ff6a00] transition hover:opacity-80">Ouvrir</Link> : "-"}</td>
                      <td className="py-3.5 pr-4">{automation ? `${trackingTrades}/${automation.trades.length} synchro` : "Pas encore"}</td>
                      <td className="py-3.5 pr-4">{formatFcfa(order.totalPriceFcfa)}</td>
                      <td className="py-3.5 pr-4">{canLaunch ? <button type="button" onClick={() => launchOrder(order.id)} disabled={isPending} className="inline-flex h-9 items-center justify-center rounded-[12px] bg-[#111827] px-3 text-[12px] font-semibold text-white transition hover:bg-[#1f2937] disabled:cursor-not-allowed disabled:opacity-60">Lancer</button> : payUrls.length > 0 ? <Link href={payUrls[0]} target="_blank" className="font-semibold text-[#ff6a00] transition hover:opacity-80">Pay URL</Link> : "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </div>
  );
}