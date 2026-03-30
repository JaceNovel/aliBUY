"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CheckCheck, CircleAlert, ClipboardList, PackageCheck, Phone, Search, ShieldCheck, Truck } from "lucide-react";

import { getOrderChatHref, getOrderTrackingNumber, type OrderRecord } from "@/lib/orders-data";

type TrackingClientProps = {
  orders: OrderRecord[];
  initialOrderId?: string;
  initialTracking?: string;
};

function resolveTrackingOrder(orders: OrderRecord[], orderId?: string, tracking?: string) {
  return orders.find((order) => order.id === orderId)
    ?? orders.find((order) => getOrderTrackingNumber(order) === tracking)
    ?? orders[0]
    ?? null;
}

function getTrackingSteps(order: OrderRecord) {
  const currentIndex =
    order.status === "Paiement en attente"
      ? 0
      : order.status === "Expedition en attente"
        ? 1
        : order.status === "Livraison en attente"
          ? 2
          : 3;

  return [
    {
      key: "received",
      title: "Commande recue",
      description: order.dateLabel.split(",")[0],
      icon: ClipboardList,
      state: currentIndex >= 0 ? "done" : "pending",
    },
    {
      key: "preparing",
      title: "En preparation",
      description: currentIndex >= 1 ? "Colis confirme" : "En attente",
      icon: CircleAlert,
      state: currentIndex >= 1 ? "done" : "pending",
    },
    {
      key: "shipped",
      title: "Expedie",
      description: currentIndex >= 2 ? order.logistics.manualFulfillmentCheckpointLabel || order.logistics.transitMode : "En attente",
      icon: Truck,
      state: currentIndex >= 2 ? "done" : "pending",
    },
    {
      key: "delivered",
      title: "Livre",
      description: currentIndex >= 3
        ? order.logistics.deliveryRouteType === "customer-forwarder"
          ? "Commande remise a votre agent"
          : "Commande remise"
        : order.logistics.manualFulfillmentEnabled
          ? order.logistics.manualFulfillmentEtaLabel || "Remise locale AfriPay en preparation"
        : order.logistics.relayPointAddress
          ? "Disponible au point relais"
          : "En attente",
      icon: PackageCheck,
      state: currentIndex >= 3 ? "done" : "pending",
    },
  ] as const;
}

function formatDateTimeLabel(value?: string) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("fr-FR");
}

function getEstimatedDeliveryLabel(order: OrderRecord) {
  if (order.status === "Commande Livree") {
    return order.dateLabel.split(",")[0];
  }

  if (order.logistics.availableForPickupAt) {
    return new Date(order.logistics.availableForPickupAt).toLocaleDateString("fr-FR");
  }

  if (order.logistics.manualFulfillmentEtaLabel) {
    return order.logistics.manualFulfillmentEtaLabel;
  }

  return "En cours de confirmation";
}

function getNextAction(order: OrderRecord) {
  if (order.status === "Paiement en attente") {
    return {
      title: "Valider le paiement",
      description: "Le dossier logistique AfriPay sera lance des validation du paiement.",
    };
  }

  if (order.logistics.relayPointAddress) {
    return {
      title: order.logistics.relayPointLabel || "Retrait au point relais",
      description: `Presentez votre numero de suivi ${order.logistics.trackingCode} lors du retrait.`,
    };
  }

  if (order.logistics.manualFulfillmentEnabled) {
    return {
      title: order.logistics.manualFulfillmentCheckpointLabel || "Suivi manuel AfriPay en cours",
      description: order.logistics.manualFulfillmentCheckpointNote || "L'equipe locale AfriPay vous contacte des que la remise finale est planifiee.",
    };
  }

  if (order.status === "Commande Livree") {
    return {
      title: "Commande archivee",
      description: "Conservez la preuve de livraison et le numero de suivi pour vos futures verifications.",
    };
  }

  return {
    title: "Transport en cours",
    description: order.logistics.lastUpdate,
  };
}

function getManualProgress(order: OrderRecord) {
  const pickupReady = Boolean(order.logistics.relayPointAddress || order.logistics.availableForPickupAt);
  const delivered = order.status === "Commande Livree";

  return [
    {
      title: "Dossier confirme",
      description: "Paiement valide et acheminement AfriPay engage.",
      state: order.status === "Paiement en attente" ? "current" : "done",
    },
    {
      title: order.logistics.manualFulfillmentCheckpointLabel || "Traitement hub AfriPay",
      description: order.logistics.manualFulfillmentStatusLabel || order.logistics.transitMode,
      state: delivered || pickupReady ? "done" : "current",
    },
    {
      title: pickupReady ? (order.logistics.relayPointLabel || "Retrait client") : "Remise finale",
      description: pickupReady
        ? order.logistics.relayPointAddress || "Disponible pour retrait"
        : order.logistics.manualFulfillmentEtaLabel || "AfriPay finalise la remise locale.",
      state: delivered ? "done" : pickupReady ? "current" : "pending",
    },
  ] as const;
}

function getProofRoleLabel(role: string) {
  switch (role) {
    case "supplier_to_agent":
      return "Depart fournisseur";
    case "agent_to_forwarder":
      return "Transfert agent";
    case "arrival_scan":
      return "Scan arrivee";
    case "relay_release":
      return "Remise relais";
    default:
      return "Archivage";
  }
}

export function TrackingClient({ orders, initialOrderId, initialTracking }: TrackingClientProps) {
  const initialOrder = resolveTrackingOrder(orders, initialOrderId, initialTracking);
  const [trackingValue, setTrackingValue] = useState(initialOrder ? getOrderTrackingNumber(initialOrder) : initialTracking ?? "");
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(initialOrder);

  const steps = useMemo(() => (selectedOrder ? getTrackingSteps(selectedOrder) : []), [selectedOrder]);
  const nextAction = useMemo(() => (selectedOrder ? getNextAction(selectedOrder) : null), [selectedOrder]);
  const manualProgress = useMemo(() => (selectedOrder?.logistics.manualFulfillmentEnabled ? getManualProgress(selectedOrder) : []), [selectedOrder]);

  const handleSearch = () => {
    const nextOrder = orders.find((order) => getOrderTrackingNumber(order) === trackingValue)
      ?? orders.find((order) => order.id === trackingValue);

    if (nextOrder) {
      setSelectedOrder(nextOrder);
    }
  };

  if (!selectedOrder) {
    return null;
  }

  return (
    <section className="mx-auto max-w-[980px] rounded-[24px] bg-white px-4 py-5 shadow-[0_8px_30px_rgba(24,39,75,0.05)] ring-1 ring-black/5 sm:rounded-[30px] sm:px-6 sm:py-7 lg:px-8">
      <h1 className="text-[28px] font-bold tracking-[-0.05em] text-[#111] sm:text-[40px]">Suivi de commande</h1>

      <div className="mt-5">
        <label className="text-[13px] font-semibold text-[#222] sm:text-[15px]">Numero de suivi</label>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <div className="flex h-12 items-center gap-3 rounded-[14px] bg-[#eef4ff] px-4 ring-1 ring-[#dde7ff] sm:flex-1">
            <Search className="h-4 w-4 text-[#456]" />
            <input
              value={trackingValue}
              onChange={(event) => setTrackingValue(event.target.value)}
              className="w-full min-w-0 bg-transparent text-[13px] font-medium text-[#223] outline-none sm:text-[15px]"
            />
          </div>
          <button
            type="button"
            onClick={handleSearch}
            className="inline-flex h-12 items-center justify-center rounded-[14px] bg-[#e7345f] px-6 text-[14px] font-semibold text-white transition hover:bg-[#d22d55]"
          >
            Rechercher
          </button>
        </div>
      </div>

      <article className="mt-6 rounded-[20px] bg-[#fafafa] px-4 py-5 ring-1 ring-black/5 sm:px-6 sm:py-6">
        <h2 className="text-[20px] font-bold tracking-[-0.04em] text-[#111] sm:text-[24px]">Informations de commande</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 sm:gap-6">
          <div>
            <div className="text-[13px] text-[#7b8794]">Numero de commande</div>
            <div className="mt-1 break-all text-[18px] font-semibold text-[#111] sm:text-[22px]">{selectedOrder.id}</div>
          </div>
          <div>
            <div className="text-[13px] text-[#7b8794]">Date de commande</div>
            <div className="mt-1 text-[18px] font-semibold text-[#111] sm:text-[22px]">{selectedOrder.dateLabel.split(",")[0]}</div>
          </div>
          <div>
            <div className="text-[13px] text-[#7b8794]">Statut</div>
            <div className="mt-1 text-[18px] font-semibold text-[#111] sm:text-[22px]">{selectedOrder.status}</div>
          </div>
          <div>
            <div className="text-[13px] text-[#7b8794]">Livraison estimee</div>
            <div className="mt-1 text-[18px] font-semibold text-[#111] sm:text-[22px]">
              {getEstimatedDeliveryLabel(selectedOrder)}
            </div>
          </div>
        </div>
      </article>

      <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-[18px] bg-[#f8fafc] px-4 py-4 ring-1 ring-[#e5eaf0]">
          <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#98a2b3]">Tracking</div>
          <div className="mt-1 text-[15px] font-semibold text-[#111]">{selectedOrder.logistics.trackingCode}</div>
        </article>
        <article className="rounded-[18px] bg-[#f8fafc] px-4 py-4 ring-1 ring-[#e5eaf0]">
          <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#98a2b3]">Corridor</div>
          <div className="mt-1 text-[15px] font-semibold text-[#111]">{selectedOrder.logistics.corridorLabel}</div>
        </article>
        <article className="rounded-[18px] bg-[#f8fafc] px-4 py-4 ring-1 ring-[#e5eaf0]">
          <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#98a2b3]">Mode</div>
          <div className="mt-1 text-[15px] font-semibold text-[#111]">{selectedOrder.logistics.transitMode}</div>
        </article>
        <article className="rounded-[18px] bg-[#f8fafc] px-4 py-4 ring-1 ring-[#e5eaf0]">
          <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#98a2b3]">Dossier</div>
          <div className="mt-1 text-[15px] font-semibold text-[#111]">{selectedOrder.logistics.proofs?.length ?? 0} preuve(s) archivee(s)</div>
        </article>
      </section>

      {nextAction ? (
        <article className="mt-4 rounded-[20px] bg-[#fff8ee] px-4 py-5 ring-1 ring-[#f5dfbe] sm:px-6 sm:py-6">
          <h2 className="text-[18px] font-bold tracking-[-0.04em] text-[#8a4b16] sm:text-[22px]">Prochaine etape</h2>
          <div className="mt-3 text-[15px] font-semibold text-[#8a4b16]">{nextAction.title}</div>
          <div className="mt-2 text-[14px] leading-7 text-[#9d6434]">{nextAction.description}</div>
        </article>
      ) : null}

      {selectedOrder.logistics.relayPointAddress ? (
        <article className="mt-4 rounded-[20px] bg-[#fff8ee] px-4 py-5 ring-1 ring-[#f5dfbe] sm:px-6 sm:py-6">
          <h2 className="text-[18px] font-bold tracking-[-0.04em] text-[#8a4b16] sm:text-[22px]">Point relais</h2>
          <div className="mt-3 text-[14px] leading-7 text-[#8a4b16]">Votre colis est disponible au point relais {selectedOrder.logistics.relayPointAddress}.</div>
          {selectedOrder.logistics.availableForPickupAt ? <div className="mt-2 text-[13px] text-[#9d6434]">Disponible depuis {new Date(selectedOrder.logistics.availableForPickupAt).toLocaleString("fr-FR")}</div> : null}
        </article>
      ) : null}

      {selectedOrder.logistics.manualFulfillmentEnabled ? (
        <article className="mt-4 rounded-[20px] bg-[#eef6ff] px-4 py-5 ring-1 ring-[#d8e5fb] sm:px-6 sm:py-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[18px] font-bold tracking-[-0.04em] text-[#1d4f91] sm:text-[22px]">Livraison manuelle AfriPay</h2>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-[12px] font-semibold text-[#1d4f91] ring-1 ring-[#d8e5fb]">
              <ShieldCheck className="h-4 w-4" />
              Suivi opere par AfriPay
            </div>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#6b85a8]">Statut</div>
              <div className="mt-1 text-[14px] font-semibold text-[#1d4f91]">{selectedOrder.logistics.manualFulfillmentStatusLabel || "Traitement AfriPay en cours"}</div>
            </div>
            <div>
              <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#6b85a8]">Checkpoint</div>
              <div className="mt-1 text-[14px] font-semibold text-[#1d4f91]">{selectedOrder.logistics.manualFulfillmentCheckpointLabel || "Réception hub AfriPay"}</div>
            </div>
            {selectedOrder.logistics.manualFulfillmentAgentName ? (
              <div>
                <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#6b85a8]">Agent</div>
                <div className="mt-1 text-[14px] font-semibold text-[#1d4f91]">{selectedOrder.logistics.manualFulfillmentAgentName}</div>
              </div>
            ) : null}
            {selectedOrder.logistics.manualFulfillmentEtaLabel ? (
              <div>
                <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#6b85a8]">Prévision</div>
                <div className="mt-1 text-[14px] font-semibold text-[#1d4f91]">{selectedOrder.logistics.manualFulfillmentEtaLabel}</div>
              </div>
            ) : null}
          </div>
          {manualProgress.length > 0 ? (
            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              {manualProgress.map((item) => (
                <div
                  key={item.title}
                  className={[
                    "rounded-[18px] px-4 py-4 ring-1",
                    item.state === "done"
                      ? "bg-[#f5fbff] text-[#1d4f91] ring-[#cfe0fb]"
                      : item.state === "current"
                        ? "bg-white text-[#1d4f91] ring-[#b8cef3]"
                        : "bg-[#f7f9fc] text-[#5f6f86] ring-[#e2e8f2]",
                  ].join(" ")}
                >
                  <div className="text-[12px] font-semibold uppercase tracking-[0.08em]">{item.state === "done" ? "Valide" : item.state === "current" ? "En cours" : "A venir"}</div>
                  <div className="mt-2 text-[15px] font-semibold">{item.title}</div>
                  <div className="mt-2 text-[13px] leading-6">{item.description}</div>
                </div>
              ))}
            </div>
          ) : null}
          {selectedOrder.logistics.manualFulfillmentCheckpointNote ? <div className="mt-3 text-[14px] leading-7 text-[#355d8e]">{selectedOrder.logistics.manualFulfillmentCheckpointNote}</div> : null}
          <div className="mt-4 flex flex-wrap gap-2">
            {selectedOrder.logistics.manualFulfillmentAgentPhone ? (
              <a href={`tel:${selectedOrder.logistics.manualFulfillmentAgentPhone}`} className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[#1d4f91] px-4 text-[13px] font-semibold text-white transition hover:bg-[#174079]">
                <Phone className="h-4 w-4" />
                Appeler l'agent
              </a>
            ) : null}
            <Link href={getOrderChatHref(selectedOrder)} className="inline-flex h-10 items-center justify-center rounded-full border border-[#b8cef3] bg-white px-4 text-[13px] font-semibold text-[#1d4f91] transition hover:border-[#1d4f91]">
              Contacter AfriPay
            </Link>
          </div>
          {selectedOrder.logistics.manualFulfillmentAgentPhone ? <div className="mt-2 text-[13px] text-[#4f6f99]">Contact agent: {selectedOrder.logistics.manualFulfillmentAgentPhone}</div> : null}
          {selectedOrder.logistics.manualFulfillmentUpdatedAt ? <div className="mt-2 text-[13px] text-[#4f6f99]">Dernière mise à jour: {formatDateTimeLabel(selectedOrder.logistics.manualFulfillmentUpdatedAt)}</div> : null}
        </article>
      ) : null}

      {selectedOrder.logistics.proofs && selectedOrder.logistics.proofs.length > 0 ? (
        <article className="mt-4 rounded-[20px] bg-[#f8fafc] px-4 py-5 ring-1 ring-[#e5eaf0] sm:px-6 sm:py-6">
          <h2 className="text-[18px] font-bold tracking-[-0.04em] text-[#111] sm:text-[22px]">Preuves archivées</h2>
          <div className="mt-4 space-y-3">
            {selectedOrder.logistics.proofs.map((proof) => (
              <div key={proof.id} className="rounded-[16px] bg-white px-4 py-4 ring-1 ring-black/5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-[14px] font-semibold text-[#111]">{proof.title}</div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-[#f5f7fa] px-3 py-1 text-[11px] font-semibold text-[#526071] ring-1 ring-[#e4e8ee]">{getProofRoleLabel(proof.role)}</div>
                </div>
                {proof.note ? <div className="mt-1 text-[13px] leading-6 text-[#667085]">{proof.note}</div> : null}
                {proof.actorLabel ? <div className="mt-2 text-[12px] font-semibold text-[#526071]">Acteur: {proof.actorLabel}</div> : null}
                {proof.mediaUrl ? <a href={proof.mediaUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-2 text-[13px] font-semibold text-[#1d4f91] transition hover:opacity-80">Voir le justificatif</a> : null}
                <div className="mt-2 text-[12px] text-[#98a2b3]">{new Date(proof.createdAt).toLocaleString("fr-FR")}</div>
              </div>
            ))}
          </div>
        </article>
      ) : null}

      <div className="mt-7 space-y-5 sm:mt-8 sm:space-y-7">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isDone = step.state === "done";

          return (
            <div key={step.key} className="relative flex gap-4 pl-2">
              {index < steps.length - 1 ? (
                <div className={["absolute left-[19px] top-12 w-[3px] rounded-full", isDone ? "bottom-[-28px] bg-[#d7ddeb]" : "bottom-[-28px] bg-[#e8ebf2]"].join(" ")} />
              ) : null}
              <div
                className={[
                  "relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1",
                  isDone ? "bg-[#d8f8df] text-[#10a34a] ring-[#bde9c9]" : "bg-[#f3f5f8] text-[#9aa3b2] ring-[#e1e6ef]",
                ].join(" ")}
              >
                {index === steps.length - 1 && isDone ? <CheckCheck className="h-5 w-5" /> : <Icon className="h-4.5 w-4.5" />}
              </div>
              <div className="min-w-0 pb-2">
                <div className="text-[17px] font-semibold tracking-[-0.03em] text-[#111] sm:text-[20px]">{step.title}</div>
                <div className="mt-1 text-[14px] text-[#7b8794] sm:text-[15px]">{step.description}</div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}