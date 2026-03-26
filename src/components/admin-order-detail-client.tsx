"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { CheckCheck, ExternalLink, PackageCheck, Save, ShieldCheck, Truck } from "lucide-react";
import { useRouter } from "next/navigation";

import { formatSourcingAmount, getSourcingAlibabaPostPaymentAutomationState, getSourcingOrderMeta, type SourcingOrder, type SourcingOrderStatus } from "@/lib/alibaba-sourcing";

type AdminOrderDetailClientProps = {
  order: SourcingOrder;
  currencyCode: string;
  locale: string;
};

const statusOptions = [
  { value: "air_batch_pending", label: "En attente lot avion" },
  { value: "sea_batch_pending", label: "En attente lot maritime" },
  { value: "supplier_payment_requested", label: "Paiement fournisseur lancé" },
  { value: "supplier_payment_failed", label: "Paiement fournisseur à reprendre" },
  { value: "supplier_paid_partial", label: "Paiement fournisseur partiel" },
  { value: "supplier_paid", label: "Fournisseur payé" },
  { value: "shipment_triggered", label: "Transport lancé" },
  { value: "in_transit_to_agent", label: "En transit vers agent" },
  { value: "delivered_to_agent", label: "Livré à l'agent" },
  { value: "relay_ready", label: "Point relais disponible" },
  { value: "completed", label: "Acheminement terminé" },
] as const;

export function AdminOrderDetailClient({ order: initialOrder, currencyCode, locale }: AdminOrderDetailClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [order, setOrder] = useState(initialOrder);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [proofForm, setProofForm] = useState({ role: "supplier_to_agent", title: "", note: "", actorLabel: "" });
  const [relayPointAddress, setRelayPointAddress] = useState("");
  const [relayPointLabel, setRelayPointLabel] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<SourcingOrderStatus>(order.status);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [isUploadingProof, setIsUploadingProof] = useState(false);
  const proofInputRef = useRef<HTMLInputElement | null>(null);

  const meta = useMemo(() => getSourcingOrderMeta(order), [order]);
  const alibabaAutomation = useMemo(() => getSourcingAlibabaPostPaymentAutomationState(order), [order]);
  const workflow = meta.workflow;
  const deliveryProfile = meta.deliveryProfile;

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
    startTransition(() => {
      router.refresh();
    });
  };

  const submitProof = async () => {
    if (!proofForm.title.trim()) {
      setFeedback("Le titre de la preuve est obligatoire.");
      return;
    }

    let mediaUrl: string | undefined;
    if (proofFile) {
      setIsUploadingProof(true);
      const formData = new FormData();
      formData.append("file", proofFile);

      const uploadResponse = await fetch("/api/admin/uploads/proofs", {
        method: "POST",
        body: formData,
      });
      const uploadPayload = await uploadResponse.json().catch(() => null);
      setIsUploadingProof(false);

      if (!uploadResponse.ok || !uploadPayload?.url) {
        setFeedback(uploadPayload?.message || "Impossible d'envoyer le fichier de preuve.");
        return;
      }

      mediaUrl = String(uploadPayload.url);
    }

    await submitPatch({ action: "add-proof", ...proofForm, mediaUrl });
    setProofForm({ role: "supplier_to_agent", title: "", note: "", actorLabel: "" });
    setProofFile(null);
    if (proofInputRef.current) {
      proofInputRef.current.value = "";
    }
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
                <option value="supplier_to_agent">Fournisseur vers agent</option>
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
      </section>

      <section className="rounded-[20px] border border-[#e6eaf0] bg-white px-5 py-5 shadow-[0_8px_22px_rgba(17,24,39,0.05)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[18px] font-bold text-[#1f2937]">Automatisation Alibaba</div>
            <div className="mt-1 text-[13px] text-[#667085]">Paiement dropshipping, résultat de paiement et suivi logistique par trade.</div>
          </div>
          {alibabaAutomation?.lastProcessedAt ? <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#98a2b3]">Dernier passage {new Date(alibabaAutomation.lastProcessedAt).toLocaleString("fr-FR")}</div> : null}
        </div>

        {!alibabaAutomation || alibabaAutomation.trades.length === 0 ? (
          <div className="mt-4 rounded-[16px] bg-[#fafbfd] px-4 py-4 text-[13px] text-[#667085] ring-1 ring-[#edf1f6]">Aucun état automatique Alibaba enregistré pour cette commande.</div>
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
                      Ouvrir pay_url
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
                    <div className="mt-1 text-[12px] leading-5 text-[#667085]">Trigger: {alibabaAutomation.lastTrigger || "n/a"}</div>
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
                          <div className="text-[13px] font-semibold text-[#1f2937]">{entry.carrier || "Transporteur Alibaba"}</div>
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