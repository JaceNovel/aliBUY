"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { CheckCheck, ExternalLink, MessageCircle, PackageCheck, Save, ShieldCheck, Trash2, Truck } from "lucide-react";
import { useRouter } from "next/navigation";

import { AFRIPAY_COMPANY_PHONE, getAfripayCourierFallbackName, getAfripayCourierFallbackPhone } from "@/lib/afripay-logistics";
import type { AdminOrderParcelSnapshot } from "@/lib/admin-order-parcel";
import {
  formatSourcingAmount,
  getSourcingAlibabaPayUrls,
  getSourcingAlibabaPostPaymentAutomationState,
  getSourcingOrderMeta,
  isSourcingOrderEligibleForSupplierPayment,
  type SourcingOrder,
  type SourcingOrderStatus,
} from "@/lib/alibaba-sourcing";

type AdminOrderDetailClientProps = {
  order: SourcingOrder;
  parcelSnapshot: AdminOrderParcelSnapshot;
  currencyCode: string;
  locale: string;
  defaultCourierName?: string;
};

const statusOptions = [
  { value: "air_batch_pending", label: "En attente lot avion" },
  { value: "sea_batch_pending", label: "En attente lot maritime" },
  { value: "supplier_payment_requested", label: "Paiement achat lance" },
  { value: "supplier_payment_failed", label: "Paiement achat a reprendre" },
  { value: "supplier_paid_partial", label: "Paiement achat partiel" },
  { value: "supplier_paid", label: "Achat regle" },
  { value: "shipment_triggered", label: "Transport lancé" },
  { value: "in_transit_to_agent", label: "En transit vers agent" },
  { value: "delivered_to_agent", label: "Livré à l'agent" },
  { value: "relay_ready", label: "Point relais disponible" },
  { value: "completed", label: "Acheminement terminé" },
] as const;

function normalizeWhatsappPhone(value?: string) {
  const digits = String(value ?? "").replace(/\D+/g, "");
  return digits.length >= 8 ? digits : "";
}

function buildWhatsappLogisticsMessage(order: SourcingOrder) {
  const meta = getSourcingOrderMeta(order);
  const checkpoint = meta.manualFulfillment?.checkpointLabel?.trim();
  const checkpointNote = meta.manualFulfillment?.checkpointNote?.trim();
  const status = meta.manualFulfillment?.statusLabel?.trim() || order.status;
  const lines = [
    "AfriPay - Mise a jour logistique",
    `Commande: ${order.orderNumber}`,
    `Statut: ${status}`,
    checkpoint ? `Checkpoint: ${checkpoint}` : undefined,
    checkpointNote || "Nous vous confirmons que votre commande est bien suivie par notre equipe.",
  ].filter((entry): entry is string => Boolean(entry));

  return lines.join("\n");
}

export function AdminOrderDetailClient({ order: initialOrder, parcelSnapshot, currencyCode, locale, defaultCourierName }: AdminOrderDetailClientProps) {
  const router = useRouter();
  const initialMeta = getSourcingOrderMeta(initialOrder);
  const initialWorkflow = initialMeta.workflow;
  const [isPending, startTransition] = useTransition();
  const [order, setOrder] = useState(initialOrder);
  const [parcelState, setParcelState] = useState(parcelSnapshot);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [proofForm, setProofForm] = useState({ role: "supplier_to_agent", title: "", note: "", actorLabel: "" });
  const [parcelNote, setParcelNote] = useState(parcelSnapshot.manualNote ?? "");
  const [parcelPhotoLabel, setParcelPhotoLabel] = useState("");
  const [manychatSubscriberId, setManychatSubscriberId] = useState(initialMeta.manychat?.subscriberId ?? "");
  const [manychatFlowId, setManychatFlowId] = useState(initialMeta.manychat?.flowId ?? "");
  const [manychatPaidTagId, setManychatPaidTagId] = useState(initialMeta.manychat?.paidTagId ?? "");
  const [manualFulfillmentEnabled, setManualFulfillmentEnabled] = useState(initialMeta.manualFulfillment?.enabled === true || initialMeta.deliveryProfile?.unsupportedCountry === true);
  const [manualFulfillmentStatusLabel, setManualFulfillmentStatusLabel] = useState(initialMeta.manualFulfillment?.statusLabel ?? "");
  const [manualFulfillmentCheckpointLabel, setManualFulfillmentCheckpointLabel] = useState(initialMeta.manualFulfillment?.checkpointLabel ?? "");
  const [manualFulfillmentCheckpointNote, setManualFulfillmentCheckpointNote] = useState(initialMeta.manualFulfillment?.checkpointNote ?? "");
  const [manualFulfillmentAgentName, setManualFulfillmentAgentName] = useState(initialMeta.manualFulfillment?.agentName ?? "");
  const [manualFulfillmentAgentPhone, setManualFulfillmentAgentPhone] = useState(initialMeta.manualFulfillment?.agentPhone ?? "");
  const [manualFulfillmentEtaLabel, setManualFulfillmentEtaLabel] = useState(initialMeta.manualFulfillment?.etaLabel ?? "");
  const [relayPointAddress, setRelayPointAddress] = useState(initialWorkflow?.relayPointAddress ?? "");
  const [relayPointLabel, setRelayPointLabel] = useState(initialWorkflow?.relayPointLabel ?? "");
  const [selectedStatus, setSelectedStatus] = useState<SourcingOrderStatus>(order.status);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [parcelPhotoFile, setParcelPhotoFile] = useState<File | null>(null);
  const [isUploadingProof, setIsUploadingProof] = useState(false);
  const [isUploadingParcelPhoto, setIsUploadingParcelPhoto] = useState(false);
  const proofInputRef = useRef<HTMLInputElement | null>(null);
  const parcelPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const meta = useMemo(() => getSourcingOrderMeta(order), [order]);

  useEffect(() => {
    setParcelState(parcelSnapshot);
    setParcelNote(parcelSnapshot.manualNote ?? "");
  }, [parcelSnapshot]);

  useEffect(() => {
    setManychatSubscriberId(meta.manychat?.subscriberId ?? "");
    setManychatFlowId(meta.manychat?.flowId ?? "");
    setManychatPaidTagId(meta.manychat?.paidTagId ?? "");
    setManualFulfillmentEnabled(meta.manualFulfillment?.enabled === true || meta.deliveryProfile?.unsupportedCountry === true);
    setManualFulfillmentStatusLabel(meta.manualFulfillment?.statusLabel ?? "");
    setManualFulfillmentCheckpointLabel(meta.manualFulfillment?.checkpointLabel ?? "");
    setManualFulfillmentCheckpointNote(meta.manualFulfillment?.checkpointNote ?? "");
    setManualFulfillmentAgentName(meta.manualFulfillment?.agentName ?? getAfripayCourierFallbackName(defaultCourierName));
    setManualFulfillmentAgentPhone(meta.manualFulfillment?.agentPhone ?? getAfripayCourierFallbackPhone(undefined));
    setManualFulfillmentEtaLabel(meta.manualFulfillment?.etaLabel ?? "");
    setRelayPointAddress(meta.workflow?.relayPointAddress ?? "");
    setRelayPointLabel(meta.workflow?.relayPointLabel ?? "");
  }, [defaultCourierName, meta]);

  const alibabaAutomation = useMemo(() => getSourcingAlibabaPostPaymentAutomationState(order), [order]);
  const payUrls = useMemo(() => getSourcingAlibabaPayUrls(order), [order]);
  const canLaunchSupplierPayment = useMemo(() => isSourcingOrderEligibleForSupplierPayment(order), [order]);
  const workflow = meta.workflow;
  const deliveryProfile = meta.deliveryProfile;
  const whatsappLinked = Boolean(meta.manychat?.subscriberId);
  const whatsappSyncDate = meta.manychat?.logisticsLastSentAt;
  const whatsappPhone = normalizeWhatsappPhone(order.customerPhone);
  const whatsappFallbackHref = whatsappPhone ? `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(buildWhatsappLogisticsMessage(order))}` : null;

  const submitPatch = async (payload: Record<string, unknown>) => {
    setFeedback(null);

    const response = await fetch(`/api/admin/sourcing/orders/${encodeURIComponent(order.id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => null);

    if (!response.ok || !data?.order) {
      setFeedback(data?.message || "Impossible de mettre à jour cette commande sourcing.");
      return;
    }

    setOrder(data.order as SourcingOrder);
    if (data?.parcelSnapshot) {
      setParcelState(data.parcelSnapshot as AdminOrderParcelSnapshot);
      setParcelNote(typeof data.parcelSnapshot.manualNote === "string" ? data.parcelSnapshot.manualNote : "");
    }
    startTransition(() => {
      router.refresh();
    });
  };

  const uploadAdminFile = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    const uploadResponse = await fetch("/api/admin/uploads/proofs", {
      method: "POST",
      body: formData,
    });
    const uploadPayload = await uploadResponse.json().catch(() => null);

    if (!uploadResponse.ok || !uploadPayload?.url) {
      throw new Error(uploadPayload?.message || "Impossible d'envoyer le fichier.");
    }

    return String(uploadPayload.url);
  };

  const submitProof = async () => {
    if (!proofForm.title.trim()) {
      setFeedback("Le titre de la preuve est obligatoire.");
      return;
    }

    let mediaUrl: string | undefined;
    if (proofFile) {
      setIsUploadingProof(true);
      let uploadError: string | null = null;

      try {
        mediaUrl = await uploadAdminFile(proofFile);
      } catch (error) {
        uploadError = error instanceof Error ? error.message : "Impossible d'envoyer le fichier de preuve.";
      }

      setIsUploadingProof(false);

      if (uploadError) {
        setFeedback(uploadError);
        return;
      }
    }

    await submitPatch({ action: "add-proof", ...proofForm, mediaUrl });
    setProofForm({ role: "supplier_to_agent", title: "", note: "", actorLabel: "" });
    setProofFile(null);
    if (proofInputRef.current) {
      proofInputRef.current.value = "";
    }
  };

  const saveParcelNote = async () => {
    await submitPatch({ action: "update-parcel-manual", note: parcelNote });
  };

  const addParcelPhoto = async () => {
    if (!parcelPhotoFile) {
      setFeedback("Choisissez une photo colis avant l'envoi.");
      return;
    }

    setIsUploadingParcelPhoto(true);
    let photoUrl: string;

    try {
      photoUrl = await uploadAdminFile(parcelPhotoFile);
    } catch (error) {
      setIsUploadingParcelPhoto(false);
      setFeedback(error instanceof Error ? error.message : "Impossible d'envoyer la photo colis.");
      return;
    }

    setIsUploadingParcelPhoto(false);
    await submitPatch({ action: "update-parcel-manual", note: parcelNote, photoUrl, photoLabel: parcelPhotoLabel });
    setParcelPhotoFile(null);
    setParcelPhotoLabel("");
    if (parcelPhotoInputRef.current) {
      parcelPhotoInputRef.current.value = "";
    }
  };

  const removeParcelPhoto = async (photoId: string) => {
    await submitPatch({ action: "remove-parcel-photo", photoId });
  };

  const saveManualFulfillment = async () => {
    await submitPatch({
      action: "update-manual-fulfillment",
      enabled: manualFulfillmentEnabled,
      statusLabel: manualFulfillmentStatusLabel,
      checkpointLabel: manualFulfillmentCheckpointLabel,
      checkpointNote: manualFulfillmentCheckpointNote,
      agentName: getAfripayCourierFallbackName(manualFulfillmentAgentName || defaultCourierName),
      agentPhone: getAfripayCourierFallbackPhone(manualFulfillmentAgentPhone || AFRIPAY_COMPANY_PHONE),
      etaLabel: manualFulfillmentEtaLabel,
    });
  };

  return (
    <div className="space-y-5">
      {feedback ? <div className="rounded-[18px] bg-[#fff8ee] px-4 py-4 text-[13px] font-semibold text-[#8a4b16]">{feedback}</div> : null}

      <section className="grid gap-4 xl:grid-cols-[0.96fr_1.04fr]">
        <article className="rounded-[20px] border border-[#e6eaf0] bg-white px-5 py-5 shadow-[0_8px_22px_rgba(17,24,39,0.05)]">
          <div className="flex items-center gap-3 text-[18px] font-bold text-[#1f2937]">
            <Truck className="h-5 w-5 text-[#ff6a5b]" />
            Routage livraison
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#98a2b3]">Route</div>
              <div className="mt-1 text-[15px] font-semibold text-[#1f2937]">{workflow?.routeType === "customer-forwarder" ? "Agent / transitaire client" : "Corridor AfriPay"}</div>
            </div>
            <div>
              <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#98a2b3]">Statut sourcing</div>
              <div className="mt-1 text-[15px] font-semibold text-[#1f2937]">{order.status}</div>
            </div>
            <div>
              <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#98a2b3]">Livraison gratuite</div>
              <div className="mt-1 text-[15px] font-semibold text-[#1f2937]">{workflow?.freeDeliveryEligible ? "Oui" : "Non"}</div>
            </div>
            <div>
              <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#98a2b3]">Total</div>
              <div className="mt-1 text-[15px] font-semibold text-[#1f2937]">{formatSourcingAmount(order.totalPriceFcfa, { currencyCode, locale })}</div>
            </div>
          </div>

          {deliveryProfile?.mode === "forwarder" ? (
            <div className="mt-5 rounded-[18px] bg-[#f6fbff] px-4 py-4 ring-1 ring-[#dbe7f5]">
              <div className="text-[13px] font-semibold text-[#1d4f91]">Transitaire {deliveryProfile.forwarder?.hub === "china" ? "Chine" : "Lomé"}</div>
              <div className="mt-2 whitespace-pre-wrap text-[13px] leading-6 text-[#43556c]">{deliveryProfile.forwarder?.addressBlock || "Adresse du transitaire non renseignée"}</div>
              {deliveryProfile.forwarder?.parcelMarking ? <div className="mt-2 text-[13px] text-[#43556c]">Marquage colis: {deliveryProfile.forwarder.parcelMarking}</div> : null}
            </div>
          ) : null}

          <div className="mt-5 rounded-[18px] bg-[#fafbfd] px-4 py-4 ring-1 ring-[#edf1f6]">
            <div className="text-[13px] font-semibold text-[#1f2937]">Adresse client</div>
            <div className="mt-2 text-[13px] leading-6 text-[#475467]">
              <div>{order.customerName}</div>
              <div>{order.addressLine1}</div>
              {order.addressLine2 ? <div>{order.addressLine2}</div> : null}
              <div>{order.city}, {order.state} {order.postalCode ?? ""}</div>
              <div>{order.countryCode}</div>
            </div>
          </div>
        </article>

        <article className="rounded-[20px] border border-[#e6eaf0] bg-white px-5 py-5 shadow-[0_8px_22px_rgba(17,24,39,0.05)]">
          <div className="flex items-center gap-3 text-[18px] font-bold text-[#1f2937]">
            <ShieldCheck className="h-5 w-5 text-[#ff6a5b]" />
            Preuves de livraison vers l&apos;agent
          </div>
          <div className="mt-4 space-y-3">
            {workflow?.proofs.length ? workflow.proofs.map((proof) => (
              <div key={proof.id} className="rounded-[16px] bg-[#fafbfd] px-4 py-4 ring-1 ring-[#edf1f6]">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[14px] font-semibold text-[#1f2937]">{proof.title}</div>
                  <div className="text-[12px] text-[#98a2b3]">{new Date(proof.createdAt).toLocaleString("fr-FR")}</div>
                </div>
                {proof.note ? <div className="mt-2 text-[13px] leading-6 text-[#667085]">{proof.note}</div> : null}
                {proof.mediaUrl ? <a href={proof.mediaUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-[13px] font-semibold text-[#ff6a5b]">Voir la preuve</a> : null}
              </div>
            )) : <div className="rounded-[16px] bg-[#fafbfd] px-4 py-4 text-[13px] text-[#667085] ring-1 ring-[#edf1f6]">Aucune preuve enregistrée pour le moment.</div>}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <label className="text-[13px] font-semibold text-[#344054]">
              Rôle preuve
              <select value={proofForm.role} onChange={(event) => setProofForm((current) => ({ ...current, role: event.target.value }))} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] outline-none focus:border-[#ff6a5b]">
                <option value="supplier_to_agent">Depart vers agent</option>
                <option value="agent_to_forwarder">Agent vers transitaire</option>
                <option value="arrival_scan">Scan arrivée</option>
                <option value="relay_release">Remise point relais</option>
              </select>
            </label>
            <label className="text-[13px] font-semibold text-[#344054]">
              Acteur
              <input value={proofForm.actorLabel} onChange={(event) => setProofForm((current) => ({ ...current, actorLabel: event.target.value }))} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] outline-none focus:border-[#ff6a5b]" />
            </label>
            <label className="sm:col-span-2 text-[13px] font-semibold text-[#344054]">
              Titre
              <input value={proofForm.title} onChange={(event) => setProofForm((current) => ({ ...current, title: event.target.value }))} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] outline-none focus:border-[#ff6a5b]" />
            </label>
            <label className="sm:col-span-2 text-[13px] font-semibold text-[#344054]">
              Note
              <textarea value={proofForm.note} onChange={(event) => setProofForm((current) => ({ ...current, note: event.target.value }))} className="mt-2 min-h-[100px] w-full rounded-[18px] border border-[#d7dce5] px-4 py-3 text-[14px] outline-none focus:border-[#ff6a5b]" />
            </label>
            <label className="sm:col-span-2 text-[13px] font-semibold text-[#344054]">
              Fichier preuve
              <input ref={proofInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf" onChange={(event) => setProofFile(event.target.files?.[0] ?? null)} className="mt-2 block w-full rounded-[14px] border border-[#d7dce5] bg-white px-4 py-3 text-[14px] outline-none file:mr-4 file:rounded-full file:border-0 file:bg-[#fff2e9] file:px-4 file:py-2 file:font-semibold file:text-[#d85300] focus:border-[#ff6a5b]" />
              <div className="mt-2 text-[12px] text-[#667085]">
                {proofFile ? `Selection: ${proofFile.name}` : "Formats acceptes: JPG, PNG, WEBP, GIF ou PDF. Maximum 10 Mo."}
              </div>
            </label>
          </div>
          <button type="button" onClick={() => void submitProof()} disabled={isPending || isUploadingProof} className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-[14px] bg-[#111827] px-5 text-[14px] font-semibold text-white transition hover:bg-[#1f2937] disabled:cursor-not-allowed disabled:opacity-70">
            <Save className="h-4 w-4" />
            {isUploadingProof ? "Envoi de la preuve..." : "Ajouter la preuve"}
          </button>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <article className="rounded-[20px] border border-[#e6eaf0] bg-white px-5 py-5 shadow-[0_8px_22px_rgba(17,24,39,0.05)]">
          <div className="flex items-center gap-3 text-[18px] font-bold text-[#1f2937]">
            <PackageCheck className="h-5 w-5 text-[#ff6a5b]" />
            Point relais client
          </div>
          <div className="mt-4 grid gap-3">
            <label className="text-[13px] font-semibold text-[#344054]">
              Adresse point relais
              <textarea value={relayPointAddress} onChange={(event) => setRelayPointAddress(event.target.value)} placeholder={workflow?.relayPointAddress || "Entrez l&apos;adresse à afficher au client"} className="mt-2 min-h-[120px] w-full rounded-[18px] border border-[#d7dce5] px-4 py-3 text-[14px] outline-none focus:border-[#ff6a5b]" />
            </label>
            <label className="text-[13px] font-semibold text-[#344054]">
              Libellé optionnel
              <input value={relayPointLabel} onChange={(event) => setRelayPointLabel(event.target.value)} placeholder={workflow?.relayPointLabel || "Point relais AfriPay"} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] outline-none focus:border-[#ff6a5b]" />
            </label>
          </div>
          <button type="button" onClick={() => void submitPatch({ action: "set-relay-point", relayPointAddress, relayPointLabel })} disabled={isPending} className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-[14px] bg-[#ff6a00] px-5 text-[14px] font-semibold text-white transition hover:bg-[#eb6200] disabled:cursor-not-allowed disabled:opacity-70">
            <CheckCheck className="h-4 w-4" />
            Publier pour le suivi client
          </button>
          {workflow?.relayPointAddress ? <div className="mt-3 text-[13px] leading-6 text-[#667085]">Adresse actuellement visible par le client: {workflow.relayPointAddress}</div> : null}
        </article>

        <article className="rounded-[20px] border border-[#e6eaf0] bg-white px-5 py-5 shadow-[0_8px_22px_rgba(17,24,39,0.05)]">
          <div className="text-[18px] font-bold text-[#1f2937]">Transitions statut</div>
          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
            <label className="text-[13px] font-semibold text-[#344054]">
              Nouveau statut sourcing
              <select value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value as SourcingOrderStatus)} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] outline-none focus:border-[#ff6a5b]">
                {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <button type="button" onClick={() => void submitPatch({ action: "update-status", status: selectedStatus })} disabled={isPending} className="inline-flex h-11 items-center justify-center rounded-[14px] bg-[#111827] px-5 text-[14px] font-semibold text-white transition hover:bg-[#1f2937] disabled:cursor-not-allowed disabled:opacity-70 sm:mt-[26px]">Mettre à jour</button>
          </div>
          <div className="mt-4 rounded-[16px] bg-[#fafbfd] px-4 py-4 text-[13px] leading-6 text-[#667085] ring-1 ring-[#edf1f6]">
            Pour les commandes vers transitaire, utilisez `Livré à l&apos;agent` dès remise à l&apos;agent. Pour vos propres flux AfriPay, utilisez `Point relais disponible` quand l&apos;acheminement est terminé et que le client doit venir retirer son colis.
          </div>
        </article>

        <article className="rounded-[20px] border border-[#e6eaf0] bg-white px-5 py-5 shadow-[0_8px_22px_rgba(17,24,39,0.05)]">
          <div className="flex items-center gap-3 text-[18px] font-bold text-[#1f2937]">
            <MessageCircle className="h-5 w-5 text-[#16a34a]" />
            Liaison ManyChat / WhatsApp
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span
              className={[
                "inline-flex min-h-10 items-center rounded-full px-4 text-[13px] font-semibold",
                whatsappLinked ? "bg-[#ecfdf3] text-[#027a48] ring-1 ring-[#abefc6]" : "bg-[#fff4ed] text-[#c2410c] ring-1 ring-[#fed7aa]",
              ].join(" ")}
            >
              Lié WhatsApp : {whatsappLinked ? "oui" : "non"}
            </span>
            {whatsappLinked ? (
              <button
                type="button"
                onClick={() => void submitPatch({ action: "send-whatsapp-update-now" })}
                disabled={isPending}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-[14px] bg-[#16a34a] px-5 text-[14px] font-semibold text-white transition hover:bg-[#12833b] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <MessageCircle className="h-4 w-4" />
                Envoyer mise à jour WhatsApp maintenant
              </button>
            ) : whatsappFallbackHref ? (
              <Link href={whatsappFallbackHref} target="_blank" className="inline-flex h-11 items-center justify-center gap-2 rounded-[14px] bg-[#16a34a] px-5 text-[14px] font-semibold text-white transition hover:bg-[#12833b]">
                <MessageCircle className="h-4 w-4" />
                Ouvrir WhatsApp client
              </Link>
            ) : (
              <button
                type="button"
                disabled
                className="inline-flex h-11 items-center justify-center gap-2 rounded-[14px] bg-[#16a34a] px-5 text-[14px] font-semibold text-white opacity-60"
              >
                <MessageCircle className="h-4 w-4" />
                Envoyer mise à jour WhatsApp maintenant
              </button>
            )}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-[13px] font-semibold text-[#344054] sm:col-span-2">
              Subscriber ManyChat
              <input value={manychatSubscriberId} onChange={(event) => setManychatSubscriberId(event.target.value)} placeholder="Ex: 123456789" className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] outline-none focus:border-[#16a34a]" />
            </label>
            <label className="text-[13px] font-semibold text-[#344054]">
              Flow suivi
              <input value={manychatFlowId} onChange={(event) => setManychatFlowId(event.target.value)} placeholder="Optionnel" className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] outline-none focus:border-[#16a34a]" />
            </label>
            <label className="text-[13px] font-semibold text-[#344054]">
              Tag paiement
              <input value={manychatPaidTagId} onChange={(event) => setManychatPaidTagId(event.target.value)} placeholder="Optionnel" className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] outline-none focus:border-[#16a34a]" />
            </label>
          </div>
          <button
            type="button"
            onClick={() => void submitPatch({ action: "update-manychat-link", subscriberId: manychatSubscriberId, flowId: manychatFlowId, paidTagId: manychatPaidTagId })}
            disabled={isPending}
            className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-[14px] bg-[#111827] px-5 text-[14px] font-semibold text-white transition hover:bg-[#1f2937] disabled:cursor-not-allowed disabled:opacity-70"
          >
            <Save className="h-4 w-4" />
            Enregistrer la liaison ManyChat
          </button>
          <div className="mt-4 rounded-[16px] bg-[#fafbfd] px-4 py-4 text-[13px] leading-6 text-[#667085] ring-1 ring-[#edf1f6]">
            {whatsappLinked
              ? `Les mises à jour logistiques peuvent partir automatiquement et manuellement via ManyChat et WhatsApp.${whatsappSyncDate ? ` Dernier envoi: ${new Date(whatsappSyncDate).toLocaleString("fr-FR")}.` : ""}`
              : whatsappFallbackHref
                ? "Aucun subscriber ManyChat n'est relié. Renseignez-le ci-dessus pour les suivis automatiques, ou utilisez le fallback WhatsApp avec message prérempli."
                : "Cette commande n'est pas encore reliée à un subscriber WhatsApp et aucun numéro client exploitable n'est disponible pour ouvrir WhatsApp."}
          </div>
        </article>

        <article className="rounded-[20px] border border-[#e6eaf0] bg-white px-5 py-5 shadow-[0_8px_22px_rgba(17,24,39,0.05)]">
          <div className="text-[18px] font-bold text-[#1f2937]">Livraison manuelle AfriPay</div>
          <div className="mt-2 text-[13px] leading-6 text-[#667085]">Pilotez ici les pays hors réseau direct fournisseur avec suivi opérateur, checkpoint et prévision client.</div>
          <label className="mt-4 inline-flex items-center gap-3 text-[13px] font-semibold text-[#344054]">
            <input checked={manualFulfillmentEnabled} onChange={(event) => setManualFulfillmentEnabled(event.target.checked)} type="checkbox" className="h-4 w-4 rounded border-[#d7dce5] text-[#ff6a00] focus:ring-[#ff6a00]" />
            Activer le workflow manuel AfriPay
          </label>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-[13px] font-semibold text-[#344054]">
              Statut visible client
              <input value={manualFulfillmentStatusLabel} onChange={(event) => setManualFulfillmentStatusLabel(event.target.value)} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] outline-none focus:border-[#ff6a5b]" placeholder="Ex: Colis reçu au hub AfriPay" />
            </label>
            <label className="text-[13px] font-semibold text-[#344054]">
              Prévision
              <input value={manualFulfillmentEtaLabel} onChange={(event) => setManualFulfillmentEtaLabel(event.target.value)} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] outline-none focus:border-[#ff6a5b]" placeholder="Ex: Remise locale sous 3 à 5 jours" />
            </label>
            <label className="text-[13px] font-semibold text-[#344054]">
              Checkpoint
              <input value={manualFulfillmentCheckpointLabel} onChange={(event) => setManualFulfillmentCheckpointLabel(event.target.value)} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] outline-none focus:border-[#ff6a5b]" placeholder="Ex: En transit vers l'agence finale" />
            </label>
            <label className="text-[13px] font-semibold text-[#344054]">
              Agent / responsable
              <input value={manualFulfillmentAgentName} onChange={(event) => setManualFulfillmentAgentName(event.target.value)} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] outline-none focus:border-[#ff6a5b]" placeholder={defaultCourierName || "Ex: Equipe Abidjan"} />
            </label>
            <label className="text-[13px] font-semibold text-[#344054] sm:col-span-2">
              Téléphone agent
              <input value={manualFulfillmentAgentPhone} onChange={(event) => setManualFulfillmentAgentPhone(event.target.value)} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] outline-none focus:border-[#ff6a5b]" placeholder={AFRIPAY_COMPANY_PHONE} />
            </label>
            <label className="text-[13px] font-semibold text-[#344054] sm:col-span-2">
              Note checkpoint
              <textarea value={manualFulfillmentCheckpointNote} onChange={(event) => setManualFulfillmentCheckpointNote(event.target.value)} className="mt-2 min-h-[110px] w-full rounded-[18px] border border-[#d7dce5] px-4 py-3 text-[14px] outline-none focus:border-[#ff6a5b]" placeholder="Ex: Colis réceptionné au hub, tri en cours avant remise au partenaire local." />
            </label>
          </div>
          <button type="button" onClick={() => void saveManualFulfillment()} disabled={isPending} className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-[14px] bg-[#111827] px-5 text-[14px] font-semibold text-white transition hover:bg-[#1f2937] disabled:cursor-not-allowed disabled:opacity-70">
            <Save className="h-4 w-4" />
            Enregistrer le suivi manuel
          </button>
        </article>
      </section>

      <section className="rounded-[20px] border border-[#e6eaf0] bg-white px-5 py-5 shadow-[0_8px_22px_rgba(17,24,39,0.05)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[18px] font-bold text-[#1f2937]">Automatisation Alibaba</div>
            <div className="mt-1 text-[13px] text-[#667085]">Paiement dropshipping, résultat de paiement et suivi logistique par trade.</div>
          </div>
          {canLaunchSupplierPayment ? (
            <button
              type="button"
              onClick={() => void submitPatch({ action: "launch-supplier-payment" })}
              disabled={isPending}
              className="inline-flex h-11 items-center justify-center rounded-[14px] bg-[#111827] px-5 text-[14px] font-semibold text-white transition hover:bg-[#1f2937] disabled:cursor-not-allowed disabled:opacity-70"
            >
              Lancer DS maintenant
            </button>
          ) : null}
          {!canLaunchSupplierPayment && payUrls.length > 0 ? (
            <Link href={payUrls[0]} target="_blank" className="inline-flex h-11 items-center justify-center gap-2 rounded-[14px] border border-[#ffd6bf] bg-[#fff6f0] px-5 text-[14px] font-semibold text-[#d85300] transition hover:opacity-80">
              Ouvrir le lien de paiement
              <ExternalLink className="h-4 w-4" />
            </Link>
          ) : null}
          {alibabaAutomation?.lastProcessedAt ? <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#98a2b3]">Dernier passage {new Date(alibabaAutomation.lastProcessedAt).toLocaleString("fr-FR")}</div> : null}
        </div>

        {!alibabaAutomation || alibabaAutomation.trades.length === 0 ? (
          <div className="mt-4 rounded-[16px] bg-[#fafbfd] px-4 py-4 text-[13px] text-[#667085] ring-1 ring-[#edf1f6]">
            {canLaunchSupplierPayment
              ? "Aucune automatisation Alibaba n'a encore été lancée pour cette commande. Utilisez le bouton ci-dessus pour creer la demande d'achat et demarrer le suivi automatique."
              : payUrls.length > 0
                ? "La demande d'achat a deja produit un lien de paiement manuel. Ouvrez-le ci-dessus pour reprendre le paiement Alibaba."
                : "Aucun état automatique Alibaba enregistré pour cette commande pour le moment."}
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {alibabaAutomation.trades.map((trade) => (
              <article key={trade.tradeId} className="rounded-[16px] bg-[#fafbfd] px-4 py-4 ring-1 ring-[#edf1f6]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-[15px] font-semibold text-[#1f2937]">Trade {trade.tradeId}</div>
                    <div className="mt-1 text-[13px] text-[#667085]">Paiement requis: {trade.paymentRequestStatus} · résultat: {trade.paymentResultStatus || "en attente"} · tracking: {trade.trackingStatus || "non lu"}</div>
                  </div>
                  {trade.payUrl ? (
                    <Link href={trade.payUrl} target="_blank" className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#ff6a5b] transition hover:opacity-80">
                      Ouvrir le lien de paiement
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  ) : null}
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-[14px] bg-white px-3 py-3 ring-1 ring-[#edf1f6]">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#98a2b3]">Paiement Alibaba</div>
                    <div className="mt-1 text-[14px] font-semibold text-[#1f2937]">{trade.paymentResultStatus || trade.paymentRequestStatus}</div>
                    {trade.paymentRequestMessage ? <div className="mt-1 text-[12px] leading-5 text-[#667085]">{trade.paymentRequestMessage}</div> : null}
                    {trade.paymentResultMessage ? <div className="mt-1 text-[12px] leading-5 text-[#667085]">{trade.paymentResultMessage}</div> : null}
                  </div>
                  <div className="rounded-[14px] bg-white px-3 py-3 ring-1 ring-[#edf1f6]">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#98a2b3]">Dernière vérification</div>
                    <div className="mt-1 text-[14px] font-semibold text-[#1f2937]">{trade.paymentResultCheckedAt ? new Date(trade.paymentResultCheckedAt).toLocaleString("fr-FR") : "Pas encore"}</div>
                    <div className="mt-1 text-[12px] leading-5 text-[#667085]">Déclencheur: {alibabaAutomation.lastTrigger || "n/a"}</div>
                  </div>
                  <div className="rounded-[14px] bg-white px-3 py-3 ring-1 ring-[#edf1f6]">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#98a2b3]">Tracking</div>
                    <div className="mt-1 text-[14px] font-semibold text-[#1f2937]">{trade.tracking[0]?.trackingNumber || "Aucun numéro"}</div>
                    <div className="mt-1 text-[12px] leading-5 text-[#667085]">{trade.tracking[0]?.carrier || trade.trackingMessage || "Aucun retour transporteur"}</div>
                  </div>
                </div>

                {trade.tracking.length > 0 ? (
                  <div className="mt-4 space-y-2">
                    {trade.tracking.map((entry, index) => (
                      <div key={`${trade.tradeId}-${entry.trackingNumber || index}`} className="rounded-[14px] bg-white px-3 py-3 ring-1 ring-[#edf1f6]">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="text-[13px] font-semibold text-[#1f2937]">{entry.carrier || "Transporteur fournisseur"}</div>
                          <div className="text-[12px] text-[#667085]">{entry.eventCount} événement(s)</div>
                        </div>
                        <div className="mt-1 text-[12px] leading-5 text-[#667085]">Numéro: {entry.trackingNumber || "n/a"}{entry.currentEventCode ? ` · état ${entry.currentEventCode}` : ""}</div>
                        {entry.trackingUrl ? <Link href={entry.trackingUrl} target="_blank" className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-[#ff6a5b] transition hover:opacity-80">Suivre le colis <ExternalLink className="h-3.5 w-3.5" /></Link> : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-[20px] border border-[#e6eaf0] bg-white px-5 py-5 shadow-[0_8px_22px_rgba(17,24,39,0.05)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[18px] font-bold text-[#1f2937]">Fiche colis & source fournisseur</div>
            <div className="mt-1 text-[13px] text-[#667085]">Vue rapide du produit source, des photos disponibles et des informations de conditionnement pour cette commande.</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {canLaunchSupplierPayment ? (
              <button
                type="button"
                onClick={() => void submitPatch({ action: "launch-supplier-payment" })}
                disabled={isPending}
                className="inline-flex h-11 items-center justify-center rounded-[14px] bg-[#111827] px-5 text-[14px] font-semibold text-white transition hover:bg-[#1f2937] disabled:cursor-not-allowed disabled:opacity-70"
              >
                Lancer DS ici
              </button>
            ) : null}
            {parcelState.parcelHref ? (
              <Link href={parcelState.parcelHref} className="inline-flex h-11 items-center justify-center rounded-[14px] border border-[#d7dce5] bg-white px-5 text-[14px] font-semibold text-[#1f2937] transition hover:border-[#ff6a5b] hover:text-[#ff6a5b]">
                Voir colis
              </Link>
            ) : null}
            <Link href={parcelState.printHref} target="_blank" className="inline-flex h-11 items-center justify-center rounded-[14px] border border-[#d7dce5] bg-white px-5 text-[14px] font-semibold text-[#1f2937] transition hover:border-[#ff6a5b] hover:text-[#ff6a5b]">
              Bon imprimable
            </Link>
            {parcelState.sourceLinks[0] ? (
              <Link href={parcelState.sourceLinks[0]} target="_blank" className="inline-flex h-11 items-center justify-center gap-2 rounded-[14px] border border-[#ffd6bf] bg-[#fff6f0] px-5 text-[14px] font-semibold text-[#d85300] transition hover:opacity-80">
              Ouvrir la source fournisseur
              <ExternalLink className="h-4 w-4" />
              </Link>
            ) : null}
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="rounded-[16px] bg-[#fafbfd] px-4 py-4 ring-1 ring-[#edf1f6]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#98a2b3]">Articles</div>
            <div className="mt-1 text-[18px] font-semibold text-[#1f2937]">{parcelState.totalItems}</div>
          </div>
          <div className="rounded-[16px] bg-[#fafbfd] px-4 py-4 ring-1 ring-[#edf1f6]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#98a2b3]">Unités</div>
            <div className="mt-1 text-[18px] font-semibold text-[#1f2937]">{parcelState.totalUnits}</div>
          </div>
          <div className="rounded-[16px] bg-[#fafbfd] px-4 py-4 ring-1 ring-[#edf1f6]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#98a2b3]">Fournisseurs</div>
            <div className="mt-1 text-[18px] font-semibold text-[#1f2937]">{parcelState.supplierNames.length}</div>
          </div>
          <div className="rounded-[16px] bg-[#fafbfd] px-4 py-4 ring-1 ring-[#edf1f6]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#98a2b3]">Photos utiles</div>
            <div className="mt-1 text-[18px] font-semibold text-[#1f2937]">{parcelState.primaryGallery.length}</div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
          <article className="rounded-[16px] bg-[#fafbfd] px-4 py-4 ring-1 ring-[#edf1f6]">
            <div className="text-[13px] font-semibold text-[#1f2937]">Routage pickup</div>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#98a2b3]">Route</div>
                <div className="mt-1 text-[14px] font-semibold text-[#1f2937]">{parcelState.routing.routeLabel}</div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#98a2b3]">Destination</div>
                <div className="mt-1 text-[14px] font-semibold text-[#1f2937]">{parcelState.routing.destinationLabel}</div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#98a2b3]">Retrait</div>
                <div className="mt-1 text-[14px] font-semibold text-[#1f2937]">{parcelState.routing.pickupLabel}</div>
              </div>
            </div>
            {parcelState.routing.pickupAddress ? <div className="mt-3 whitespace-pre-wrap text-[13px] leading-6 text-[#667085]">{parcelState.routing.pickupAddress}</div> : null}
            {parcelState.routing.pickupReadyAt ? <div className="mt-2 text-[12px] text-[#667085]">Disponible depuis {new Date(parcelState.routing.pickupReadyAt).toLocaleString("fr-FR")}</div> : null}
          </article>

          <article className="rounded-[16px] bg-[#fafbfd] px-4 py-4 ring-1 ring-[#edf1f6]">
            <div className="text-[13px] font-semibold text-[#1f2937]">Edition manuelle colis</div>
            <label className="mt-3 block text-[13px] font-semibold text-[#344054]">
              Note colis / pickup
              <textarea value={parcelNote} onChange={(event) => setParcelNote(event.target.value)} className="mt-2 min-h-[120px] w-full rounded-[18px] border border-[#d7dce5] px-4 py-3 text-[14px] outline-none focus:border-[#ff6a5b]" placeholder="Ajoutez les consignes colis, état du package, anomalies, point de retrait ou consignes agent." />
            </label>
            <button type="button" onClick={() => void saveParcelNote()} disabled={isPending} className="mt-3 inline-flex h-11 items-center justify-center gap-2 rounded-[14px] bg-[#111827] px-5 text-[14px] font-semibold text-white transition hover:bg-[#1f2937] disabled:cursor-not-allowed disabled:opacity-70">
              <Save className="h-4 w-4" />
              Enregistrer la note colis
            </button>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-[13px] font-semibold text-[#344054] sm:col-span-2">
                Libellé photo optionnel
                <input value={parcelPhotoLabel} onChange={(event) => setParcelPhotoLabel(event.target.value)} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] outline-none focus:border-[#ff6a5b]" placeholder="Ex: colis reçu, angle gauche, étiquette transitaire" />
              </label>
              <label className="text-[13px] font-semibold text-[#344054] sm:col-span-2">
                Photo colis
                <input ref={parcelPhotoInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => setParcelPhotoFile(event.target.files?.[0] ?? null)} className="mt-2 block w-full rounded-[14px] border border-[#d7dce5] bg-white px-4 py-3 text-[14px] outline-none file:mr-4 file:rounded-full file:border-0 file:bg-[#fff2e9] file:px-4 file:py-2 file:font-semibold file:text-[#d85300] focus:border-[#ff6a5b]" />
                <div className="mt-2 text-[12px] text-[#667085]">{parcelPhotoFile ? `Selection: ${parcelPhotoFile.name}` : "Formats acceptes: JPG, PNG, WEBP ou GIF."}</div>
              </label>
            </div>
            <button type="button" onClick={() => void addParcelPhoto()} disabled={isPending || isUploadingParcelPhoto} className="mt-3 inline-flex h-11 items-center justify-center gap-2 rounded-[14px] border border-[#d7dce5] bg-white px-5 text-[14px] font-semibold text-[#1f2937] transition hover:border-[#ff6a5b] hover:text-[#ff6a5b] disabled:cursor-not-allowed disabled:opacity-70">
              {isUploadingParcelPhoto ? "Envoi photo colis..." : "Ajouter la photo colis"}
            </button>
          </article>
        </div>

        {parcelState.photoEntries.length > 0 ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {parcelState.photoEntries.slice(0, 12).map((photo, index) => (
              <div key={photo.id} className="overflow-hidden rounded-[18px] bg-[#fafbfd] ring-1 ring-[#edf1f6]">
                <a href={photo.url} target="_blank" rel="noreferrer" className="group block transition hover:opacity-90">
                  <img src={photo.url} alt={`Photo colis ${index + 1}`} className="h-44 w-full object-cover" />
                </a>
                <div className="flex items-center justify-between gap-2 px-3 py-3 text-[12px] text-[#475467]">
                  <div className="font-semibold">{photo.source === "manual" ? (photo.label || "Photo colis manuelle") : photo.source === "proof" ? "Photo/preuve colis" : (photo.label || "Photo fiche source")}</div>
                  {photo.source === "manual" ? (
                    <button type="button" onClick={() => void removeParcelPhoto(photo.id)} disabled={isPending} className="inline-flex items-center gap-1 font-semibold text-[#d85300] transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-60">
                      <Trash2 className="h-3.5 w-3.5" />
                      Retirer
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-[16px] bg-[#fafbfd] px-4 py-4 text-[13px] text-[#667085] ring-1 ring-[#edf1f6]">Aucune photo colis ou photo source n&apos;est disponible pour cette commande.</div>
        )}

        <div className="mt-4 space-y-3">
          {parcelState.items.map((item, index) => (
            <article key={`${item.slug}-${index}`} className="rounded-[16px] bg-[#fafbfd] px-4 py-4 ring-1 ring-[#edf1f6]">
              <div className="grid gap-4 lg:grid-cols-[132px_1fr]">
                <div className="overflow-hidden rounded-[16px] bg-white ring-1 ring-[#edf1f6]">
                  <img src={item.image} alt={item.title} className="h-32 w-full object-cover" />
                </div>
                <div>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-[15px] font-semibold text-[#1f2937]">{item.title}</div>
                      <div className="mt-1 text-[13px] leading-6 text-[#667085]">Quantité {item.quantity}{item.selectionLabel ? ` · ${item.selectionLabel}` : ""}{item.sourceProductId ? ` · Source ${item.sourceProductId}` : ""}</div>
                    </div>
                    {item.sourceUrl ? (
                      <Link href={item.sourceUrl} target="_blank" className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#ff6a5b] transition hover:opacity-80">
                        Voir sur le produit source
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    ) : null}
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <div className="rounded-[14px] bg-white px-3 py-3 ring-1 ring-[#edf1f6]">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#98a2b3]">Fournisseur</div>
                      <div className="mt-1 text-[14px] font-semibold text-[#1f2937]">{item.supplierName || "Non relié"}</div>
                      <div className="mt-1 text-[12px] leading-5 text-[#667085]">{item.supplierLocation || "Aucune localisation fournisseur"}</div>
                    </div>
                    <div className="rounded-[14px] bg-white px-3 py-3 ring-1 ring-[#edf1f6]">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#98a2b3]">Conditionnement</div>
                      <div className="mt-1 text-[14px] font-semibold text-[#1f2937]">{item.packaging || "Non renseigné"}</div>
                    </div>
                    <div className="rounded-[14px] bg-white px-3 py-3 ring-1 ring-[#edf1f6]">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#98a2b3]">Poids unitaire</div>
                      <div className="mt-1 text-[14px] font-semibold text-[#1f2937]">{typeof item.itemWeightGrams === "number" && item.itemWeightGrams > 0 ? `${(item.itemWeightGrams / 1000).toFixed(3)} kg` : "Non renseigné"}</div>
                    </div>
                  </div>

                  {item.overview.length > 0 ? <div className="mt-3 text-[13px] leading-6 text-[#667085]">{item.overview.slice(0, 3).join(" · ")}</div> : null}
                  {item.specs.length > 0 ? <div className="mt-2 text-[12px] leading-6 text-[#667085]">{item.specs.slice(0, 3).map((spec) => `${spec.label}: ${spec.value}`).join(" · ")}</div> : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-[20px] border border-[#e6eaf0] bg-white px-5 py-5 shadow-[0_8px_22px_rgba(17,24,39,0.05)]">
        <div className="text-[18px] font-bold text-[#1f2937]">Articles commandés</div>
        <div className="mt-4 space-y-3">
          {order.items.map((item, index) => (
            <div key={`${order.id}-${item.slug}-${index}`} className="rounded-[16px] bg-[#fafbfd] px-4 py-4 ring-1 ring-[#edf1f6]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-[15px] font-semibold text-[#1f2937]">{item.title}</div>
                  <div className="mt-1 text-[13px] leading-6 text-[#667085]">Quantité {item.quantity} · {item.weightKg.toFixed(3)} kg · {item.volumeCbm.toFixed(4)} CBM</div>
                </div>
                <div className="text-right">
                  <div className="text-[15px] font-semibold text-[#1f2937]">{formatSourcingAmount(item.finalLinePriceFcfa, { currencyCode, locale })}</div>
                  <div className="mt-1 text-[12px] text-[#667085]">Unité {formatSourcingAmount(item.finalUnitPriceFcfa, { currencyCode, locale })}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
