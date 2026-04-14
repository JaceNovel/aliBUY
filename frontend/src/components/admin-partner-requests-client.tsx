"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, RefreshCcw, ShieldCheck, X } from "lucide-react";

import {
  extractApiErrorMessage,
  normalizeAdminPartnerRequestItem,
  normalizeAdminPartnerRequests,
  type AdminPartnerRequestItem,
  type ApprovedPartnerCredentials,
} from "@/lib/admin-partner-requests";

type AdminPartnerRequestsClientProps = {
  initialRequests: AdminPartnerRequestItem[];
  warning?: string | null;
  manyChatStatus: {
    apiKey: {
      ok: boolean;
      detail: string;
    };
    orderFlow: {
      ok: boolean;
      detail: string;
    };
    cartFlow: {
      ok: boolean;
      detail: string;
    };
    cronRoute: {
      ok: boolean;
      detail: string;
    };
  };
};

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function statusLabel(status: string) {
  if (status === "approved") {
    return "Approuvee";
  }

  if (status === "rejected") {
    return "Refusee";
  }

  if (status === "blocked") {
    return "Bloquee";
  }

  return "En attente";
}

function statusClass(status: string) {
  if (status === "approved") {
    return "bg-[#dcfae6] text-[#15803d]";
  }

  if (status === "rejected") {
    return "bg-[#fee2e2] text-[#dc2626]";
  }

  if (status === "blocked") {
    return "bg-[#111827] text-white";
  }

  return "bg-[#fff4db] text-[#b45309]";
}

export function AdminPartnerRequestsClient({ initialRequests, warning, manyChatStatus }: AdminPartnerRequestsClientProps) {
  const [requests, setRequests] = useState(initialRequests);
  const [selectedRequestId, setSelectedRequestId] = useState(initialRequests[0]?.id ?? "");
  const [webhookUrl, setWebhookUrl] = useState(initialRequests[0]?.website ?? "");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [decisionReason, setDecisionReason] = useState(initialRequests[0]?.decisionReason ?? "");
  const [approvalResult, setApprovalResult] = useState<ApprovedPartnerCredentials | null>(null);
  const [copiedField, setCopiedField] = useState<"appKey" | "appSecret" | null>(null);

  useEffect(() => {
    setRequests(initialRequests);
  }, [initialRequests]);

  useEffect(() => {
    setSelectedRequestId((current) => {
      if (current && requests.some((request) => request.id === current)) {
        return current;
      }

      return requests[0]?.id ?? "";
    });
  }, [requests]);

  const selectedRequest = useMemo(
    () => requests.find((request) => request.id === selectedRequestId) ?? requests[0] ?? null,
    [requests, selectedRequestId],
  );

  useEffect(() => {
    setWebhookUrl(selectedRequest?.website ?? "");
    setDecisionReason(selectedRequest?.decisionReason ?? "");
  }, [selectedRequest?.id, selectedRequest?.website]);

  const counts = useMemo(() => ({
    total: requests.length,
    pending: requests.filter((request) => request.status === "pending").length,
    approved: requests.filter((request) => request.status === "approved").length,
    blocked: requests.filter((request) => request.status === "blocked").length,
    rejected: requests.filter((request) => request.status === "rejected").length,
  }), [requests]);

  function updateRequestInState(id: string, candidate: unknown) {
    const normalized = normalizeAdminPartnerRequestItem(candidate);
    if (!normalized) {
      return;
    }

    setRequests((current) => current.map((entry) => entry.id === id ? normalized : entry));
  }

  async function refreshRequests() {
    setBusyAction("refresh");
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/admin/partner-requests", {
        cache: "no-store",
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setError(extractApiErrorMessage(payload, "Impossible de recharger les demandes partenaire."));
        return;
      }

      setRequests(normalizeAdminPartnerRequests(payload?.items));
    } catch {
      setError("Impossible de recharger les demandes partenaire.");
    } finally {
      setBusyAction(null);
    }
  }

  async function approveRequest(request: AdminPartnerRequestItem) {
    setBusyAction(`approve:${request.id}`);
    setError(null);
    setNotice(null);
    setApprovalResult(null);

    try {
      const response = await fetch(`/api/admin/partner-requests/${encodeURIComponent(request.id)}/approve`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          webhook_url: webhookUrl.trim() || undefined,
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setError(extractApiErrorMessage(payload, "Impossible d'approuver cette demande partenaire."));
        return;
      }

      updateRequestInState(request.id, payload?.request);
      setApprovalResult({
        companyName: request.companyName,
        email: typeof payload?.partner?.email === "string" ? payload.partner.email : request.email,
        appKey: typeof payload?.partner?.app_key === "string" ? payload.partner.app_key : "",
        appSecret: typeof payload?.app_secret === "string" ? payload.app_secret : "",
        webhookUrl: typeof payload?.partner?.webhook_url === "string" ? payload.partner.webhook_url : null,
      });
      setNotice("La demande partenaire a ete approuvee. Les identifiants API ci-dessous sont a transmettre une seule fois au partenaire.");
    } catch {
      setError("Impossible d'approuver cette demande partenaire.");
    } finally {
      setBusyAction(null);
    }
  }

  async function rejectRequest(request: AdminPartnerRequestItem) {
    setBusyAction(`reject:${request.id}`);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`/api/admin/partner-requests/${encodeURIComponent(request.id)}/reject`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          reason: decisionReason.trim() || undefined,
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setError(extractApiErrorMessage(payload, "Impossible de refuser cette demande partenaire."));
        return;
      }

      updateRequestInState(request.id, payload?.request);
      setNotice("La demande partenaire a ete refusee.");
    } catch {
      setError("Impossible de refuser cette demande partenaire.");
    } finally {
      setBusyAction(null);
    }
  }

  async function blockRequest(request: AdminPartnerRequestItem) {
    setBusyAction(`block:${request.id}`);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`/api/admin/partner-requests/${encodeURIComponent(request.id)}/block`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          reason: decisionReason.trim() || undefined,
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setError(extractApiErrorMessage(payload, "Impossible de bloquer ce compte partenaire."));
        return;
      }

      updateRequestInState(request.id, payload?.request);
      setNotice("Le compte partenaire a ete bloque et l acces LIVE a ete coupe.");
    } catch {
      setError("Impossible de bloquer ce compte partenaire.");
    } finally {
      setBusyAction(null);
    }
  }

  async function reactivateRequest(request: AdminPartnerRequestItem) {
    setBusyAction(`reactivate:${request.id}`);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`/api/admin/partner-requests/${encodeURIComponent(request.id)}/reactivate`, {
        method: "POST",
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setError(extractApiErrorMessage(payload, "Impossible de reactiver ce compte partenaire."));
        return;
      }

      updateRequestInState(request.id, payload?.request);
      setDecisionReason("");
      setNotice("Le compte partenaire a ete reactive.");
    } catch {
      setError("Impossible de reactiver ce compte partenaire.");
    } finally {
      setBusyAction(null);
    }
  }

  async function copyValue(value: string, field: "appKey" | "appSecret") {
    if (!value) {
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      window.setTimeout(() => setCopiedField((current) => current === field ? null : current), 1800);
    } catch {
      setError("Impossible de copier cette valeur automatiquement.");
    }
  }

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#ff6a3d]">Partnership admin</div>
          <h1 className="mt-2 text-[30px] font-black tracking-[-0.05em] text-[#101828]">Demandes partenaire</h1>
          <p className="mt-2 max-w-[760px] text-[15px] text-[#667085]">Lisez chaque dossier, verifiez le site et la description, puis acceptez ou refusez la demande directement depuis l'admin.</p>
        </div>
        <button
          type="button"
          onClick={refreshRequests}
          disabled={busyAction === "refresh"}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-[12px] border border-[#d0d5dd] bg-white px-4 text-[14px] font-semibold text-[#101828] transition hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCcw className="h-4 w-4" />
          Actualiser
        </button>
      </section>

      {warning ? (
        <section className="rounded-[16px] border border-[#f3d4a4] bg-[#fff7eb] px-4 py-3 text-[14px] text-[#8a5a00]">{warning}</section>
      ) : null}
      {error ? (
        <section className="rounded-[16px] border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-[14px] text-[#b91c1c]">{error}</section>
      ) : null}
      {notice ? (
        <section className="rounded-[16px] border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3 text-[14px] text-[#166534]">{notice}</section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {[
          { label: "Total", value: counts.total, accent: "text-[#101828]" },
          { label: "En attente", value: counts.pending, accent: "text-[#b45309]" },
          { label: "Approuvees", value: counts.approved, accent: "text-[#15803d]" },
          { label: "Bloquees", value: counts.blocked, accent: "text-[#111827]" },
          { label: "Refusees", value: counts.rejected, accent: "text-[#dc2626]" },
        ].map((card) => (
          <article key={card.label} className="rounded-[18px] border border-[#e7ebf1] bg-white px-5 py-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
            <div className="text-[14px] font-semibold text-[#667085]">{card.label}</div>
            <div className={`mt-3 text-[28px] font-black tracking-[-0.05em] ${card.accent}`}>{card.value}</div>
          </article>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <article className="overflow-hidden rounded-[18px] border border-[#e7ebf1] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
          <div className="border-b border-[#edf1f6] px-5 py-4">
            <div className="text-[18px] font-bold text-[#101828]">Demandes recues</div>
            <div className="mt-1 text-[13px] text-[#667085]">Chaque ligne ouvre le dossier complet avec actions admin.</div>
          </div>

          <div className="max-h-[720px] overflow-y-auto">
            {requests.length === 0 ? (
              <div className="px-5 py-8 text-[14px] text-[#667085]">Aucune demande partenaire disponible.</div>
            ) : requests.map((request) => (
              <button
                key={request.id}
                type="button"
                onClick={() => {
                  setSelectedRequestId(request.id);
                  setWebhookUrl(request.website ?? "");
                  setApprovalResult(null);
                  setError(null);
                  setNotice(null);
                }}
                className={[
                  "flex w-full flex-col gap-3 border-b border-[#edf1f6] px-5 py-4 text-left transition hover:bg-[#fbfcfe]",
                  selectedRequest?.id === request.id ? "bg-[#fbfcfe]" : "bg-white",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[15px] font-bold text-[#101828]">{request.companyName}</div>
                    <div className="mt-1 text-[13px] text-[#667085]">{request.email}</div>
                  </div>
                  <span className={`inline-flex rounded-full px-3 py-1 text-[12px] font-semibold ${statusClass(request.status)}`}>{statusLabel(request.status)}</span>
                </div>
                <div className="line-clamp-2 text-[13px] leading-6 text-[#475467]">{request.description || "Aucune description fournie."}</div>
                <div className="flex items-center justify-between gap-3 text-[12px] text-[#98a2b3]">
                  <span>{formatDate(request.createdAt)}</span>
                  <span>{request.website || "Site non renseigne"}</span>
                </div>
              </button>
            ))}
          </div>
        </article>

        <div className="space-y-4">
          <article className="rounded-[18px] border border-[#e7ebf1] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[18px] font-bold text-[#101828]">Lecture du dossier</div>
                <div className="mt-1 text-[13px] text-[#667085]">Validez apres verification du site, de l'email et du besoin exprime.</div>
              </div>
              {selectedRequest ? (
                <span className={`inline-flex rounded-full px-3 py-1 text-[12px] font-semibold ${statusClass(selectedRequest.status)}`}>{statusLabel(selectedRequest.status)}</span>
              ) : null}
            </div>

            {!selectedRequest ? (
              <div className="mt-6 text-[14px] text-[#667085]">Selectionnez une demande dans la liste pour lire le dossier complet.</div>
            ) : (
              <div className="mt-5 space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-[16px] border border-[#edf1f6] bg-[#fbfcfe] px-4 py-4">
                    <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#98a2b3]">Entreprise</div>
                    <div className="mt-2 text-[18px] font-bold text-[#101828]">{selectedRequest.companyName}</div>
                  </div>
                  <div className="rounded-[16px] border border-[#edf1f6] bg-[#fbfcfe] px-4 py-4">
                    <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#98a2b3]">Email</div>
                    <div className="mt-2 break-all text-[16px] font-semibold text-[#101828]">{selectedRequest.email}</div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-[16px] border border-[#edf1f6] bg-white px-4 py-4">
                    <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#98a2b3]">Site web</div>
                    <div className="mt-2 break-all text-[15px] text-[#101828]">{selectedRequest.website || "Non renseigne"}</div>
                  </div>
                  <div className="rounded-[16px] border border-[#edf1f6] bg-white px-4 py-4">
                    <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#98a2b3]">Date de demande</div>
                    <div className="mt-2 text-[15px] text-[#101828]">{formatDate(selectedRequest.createdAt)}</div>
                  </div>
                </div>

                <div className="rounded-[16px] border border-[#edf1f6] bg-white px-4 py-4">
                  <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#98a2b3]">Description</div>
                  <div className="mt-3 whitespace-pre-wrap text-[15px] leading-7 text-[#101828]">{selectedRequest.description || "Aucune description fournie."}</div>
                </div>

                <div className="rounded-[16px] border border-[#edf1f6] bg-white px-4 py-4">
                  <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#98a2b3]">Motif admin</div>
                  <textarea
                    value={decisionReason}
                    onChange={(event) => setDecisionReason(event.target.value)}
                    rows={4}
                    placeholder={selectedRequest.status === "approved" || selectedRequest.status === "blocked" ? "Motif de blocage ou note admin" : "Motif de refus, ex: Dossier non coherent"}
                    className="mt-3 w-full rounded-[12px] border border-[#d0d5dd] px-3 py-3 text-[14px] outline-none focus:border-[#2563eb]"
                  />
                  <div className="mt-2 text-[12px] text-[#667085]">{selectedRequest.decisionReason || "Le motif sera visible cote client lorsque la demande est refusee ou que le compte partenaire est bloque."}</div>
                </div>

                {selectedRequest.status === "pending" ? (
                  <div className="rounded-[16px] border border-[#dbeafe] bg-[#f8fbff] px-4 py-4">
                    <div className="text-[13px] font-semibold text-[#1d4ed8]">Validation</div>
                    <div className="mt-2 text-[13px] leading-6 text-[#475467]">Vous pouvez garder le site de la demande ou saisir une URL de webhook avant approbation.</div>
                    <input
                      value={webhookUrl}
                      onChange={(event) => setWebhookUrl(event.target.value)}
                      placeholder="https://partner.example.com/webhooks/afripay"
                      className="mt-4 h-11 w-full rounded-[12px] border border-[#d0d5dd] px-3 text-[14px] outline-none focus:border-[#2563eb]"
                    />
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => approveRequest(selectedRequest)}
                        disabled={busyAction === `approve:${selectedRequest.id}` || busyAction === `reject:${selectedRequest.id}`}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-[12px] bg-[#15803d] px-4 text-[14px] font-semibold text-white transition hover:bg-[#166534] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <ShieldCheck className="h-4 w-4" />
                        Approuver
                      </button>
                      <button
                        type="button"
                        onClick={() => rejectRequest(selectedRequest)}
                        disabled={busyAction === `approve:${selectedRequest.id}` || busyAction === `reject:${selectedRequest.id}`}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-[12px] border border-[#fecaca] bg-white px-4 text-[14px] font-semibold text-[#b91c1c] transition hover:bg-[#fef2f2] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <X className="h-4 w-4" />
                        Refuser
                      </button>
                    </div>
                  </div>
                ) : null}

                {selectedRequest.status === "approved" ? (
                  <div className="rounded-[16px] border border-[#e5e7eb] bg-[#f9fafb] px-4 py-4">
                    <div className="text-[13px] font-semibold text-[#111827]">Blocage post-approbation</div>
                    <div className="mt-2 text-[13px] leading-6 text-[#475467]">Utilisez ce bloc si vous detectez des tentatives suspectes ou un usage non conforme apres validation.</div>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => blockRequest(selectedRequest)}
                        disabled={busyAction === `block:${selectedRequest.id}`}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-[12px] bg-[#111827] px-4 text-[14px] font-semibold text-white transition hover:bg-[#1f2937] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <X className="h-4 w-4" />
                        Bloquer le compte
                      </button>
                    </div>
                  </div>
                ) : null}

                {selectedRequest.status === "blocked" ? (
                  <div className="rounded-[16px] border border-[#d1d5db] bg-[#f9fafb] px-4 py-4">
                    <div className="text-[13px] font-semibold text-[#111827]">Compte actuellement bloque</div>
                    <div className="mt-2 text-[13px] leading-6 text-[#475467]">Le dashboard partenaire est coupe pour ce compte. Reactivez-le seulement apres verification.</div>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => reactivateRequest(selectedRequest)}
                        disabled={busyAction === `reactivate:${selectedRequest.id}`}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-[12px] border border-[#bbf7d0] bg-white px-4 text-[14px] font-semibold text-[#15803d] transition hover:bg-[#f0fdf4] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <ShieldCheck className="h-4 w-4" />
                        Reactiver le compte
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </article>

          {approvalResult ? (
            <article className="rounded-[18px] border border-[#bbf7d0] bg-[#f0fdf4] p-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
              <div className="text-[18px] font-bold text-[#166534]">Identifiants generes</div>
              <div className="mt-2 text-[13px] text-[#166534]">Ces informations ne reviennent qu'au moment de l'approbation. Conservez-les avant de quitter la page.</div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="rounded-[14px] border border-[#d1fadf] bg-white px-4 py-4">
                  <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#98a2b3]">Entreprise</div>
                  <div className="mt-2 text-[15px] font-semibold text-[#101828]">{approvalResult.companyName}</div>
                </div>
                <div className="rounded-[14px] border border-[#d1fadf] bg-white px-4 py-4">
                  <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#98a2b3]">Email</div>
                  <div className="mt-2 break-all text-[15px] font-semibold text-[#101828]">{approvalResult.email}</div>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {[
                  { label: "App key", value: approvalResult.appKey, field: "appKey" as const },
                  { label: "App secret", value: approvalResult.appSecret, field: "appSecret" as const },
                ].map((entry) => (
                  <div key={entry.label} className="rounded-[14px] border border-[#d1fadf] bg-white px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#98a2b3]">{entry.label}</div>
                      <button
                        type="button"
                        onClick={() => copyValue(entry.value, entry.field)}
                        className="inline-flex h-8 items-center justify-center gap-1 rounded-[10px] border border-[#d0d5dd] px-3 text-[12px] font-semibold text-[#101828] transition hover:bg-[#f8fafc]"
                      >
                        {copiedField === entry.field ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        {copiedField === entry.field ? "Copie" : "Copier"}
                      </button>
                    </div>
                    <div className="mt-2 break-all rounded-[10px] bg-[#f8fafc] px-3 py-3 font-mono text-[13px] text-[#101828]">{entry.value || "Non fourni"}</div>
                  </div>
                ))}
              </div>
            </article>
          ) : null}

          <article className="rounded-[18px] border border-[#e7ebf1] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
            <div className="text-[18px] font-bold text-[#101828]">Etat ManyChat</div>
            <div className="mt-2 text-[13px] text-[#667085]">Verification technique des branchements principaux cote frontend.</div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {[
                { label: "API key", ...manyChatStatus.apiKey },
                { label: "Flow paiement", ...manyChatStatus.orderFlow },
                { label: "Flow panier abandonne", ...manyChatStatus.cartFlow },
                { label: "Route cron active", ...manyChatStatus.cronRoute },
              ].map((item) => (
                <div key={item.label} className="rounded-[14px] border border-[#edf1f6] bg-[#fbfcfe] px-4 py-4">
                  <div className="text-[13px] font-semibold text-[#101828]">{item.label}</div>
                  <div className={`mt-2 text-[14px] font-semibold ${item.ok ? "text-[#15803d]" : "text-[#dc2626]"}`}>{item.ok ? "OK" : "A configurer"}</div>
                  <div className="mt-2 text-[12px] leading-5 text-[#667085]">{item.detail}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 text-[13px] leading-6 text-[#667085]">Les notifications paiement et logistique sont deja branchees dans le code. Les relances panier et devis abandonnes dependent de cette route cron et des variables ManyChat en production.</div>
          </article>
        </div>
      </section>
    </div>
  );
}