"use client";

import { useState } from "react";
import { Copy, ExternalLink, Plus, Save, Trash2 } from "lucide-react";

import type { PromoCodeRecord } from "@/lib/promo-codes-store";

function createDraftPromoCode(): PromoCodeRecord {
  const timestamp = new Date().toISOString();

  return {
    id: `draft-${timestamp}`,
    code: "",
    label: "",
    description: "",
    amountType: "fixed_fcfa",
    amountValue: 0,
    minOrderFcfa: 0,
    maxDiscountFcfa: undefined,
    active: true,
    startsAt: "",
    endsAt: "",
    usageLimit: undefined,
    usageCount: 0,
    usedOrderIds: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function AdminPromoCodesClient({ initialPromoCodes }: { initialPromoCodes: PromoCodeRecord[] }) {
  const [promoCodes, setPromoCodes] = useState(initialPromoCodes);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [copyingId, setCopyingId] = useState<string | null>(null);

  const buildReceivePath = (code: string) => `/checkout?promo=${encodeURIComponent(code.trim().toUpperCase())}`;

  const copyReceiveLink = async (promoCode: PromoCodeRecord) => {
    const code = promoCode.code.trim().toUpperCase();
    if (!code) {
      setFeedback("Ajoutez un code avant de partager un lien de réception.");
      return;
    }

    if (typeof window === "undefined" || !navigator.clipboard) {
      setFeedback("Copie indisponible sur ce navigateur. Ouvrez le lien manuellement.");
      return;
    }

    setCopyingId(promoCode.id);
    try {
      const receivePath = buildReceivePath(code);
      await navigator.clipboard.writeText(`${window.location.origin}${receivePath}`);
      setFeedback(`Lien de réception copié pour ${code}.`);
    } catch {
      setFeedback("Impossible de copier le lien de réception.");
    } finally {
      setCopyingId(null);
    }
  };

  const updatePromoCode = <Key extends keyof PromoCodeRecord>(id: string, key: Key, value: PromoCodeRecord[Key]) => {
    setPromoCodes((current) => current.map((promoCode) => (promoCode.id === id ? { ...promoCode, [key]: value } : promoCode)));
  };

  const savePromoCode = async (promoCode: PromoCodeRecord) => {
    setSavingId(promoCode.id);
    setFeedback(null);

    try {
      const response = await fetch("/api/admin/promo-codes", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          ...promoCode,
          code: promoCode.code.trim().toUpperCase(),
          label: promoCode.label.trim(),
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.id) {
        throw new Error(payload?.message || "Impossible d'enregistrer ce code promo.");
      }

      setPromoCodes((current) => current.map((entry) => (entry.id === promoCode.id ? payload : entry)));
      setFeedback(`Code ${payload.code} enregistré.`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Impossible d'enregistrer ce code promo.");
    } finally {
      setSavingId(null);
    }
  };

  const deletePromoCode = async (promoCode: PromoCodeRecord) => {
    if (promoCode.id.startsWith("draft-")) {
      setPromoCodes((current) => current.filter((entry) => entry.id !== promoCode.id));
      return;
    }

    const response = await fetch("/api/admin/promo-codes", {
      method: "DELETE",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ codeOrId: promoCode.id }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !Array.isArray(payload)) {
      setFeedback(typeof payload?.message === "string" ? payload.message : "Impossible de supprimer ce code promo.");
      return;
    }

    setPromoCodes(payload);
    setFeedback(`Code ${promoCode.code} supprimé.`);
  };

  return (
    <div className="space-y-5">
      <section className="rounded-[18px] border border-[#e7ebf1] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-[28px] font-black tracking-[-0.05em] text-[#12233d]">Gestion des Codes Promo</h1>
            <p className="mt-1 text-[14px] text-[#667085]">Créez des remises temporaires applicables au checkout sourcing avant la validation de la commande.</p>
          </div>
          <button type="button" onClick={() => setPromoCodes((current) => [createDraftPromoCode(), ...current])} className="inline-flex h-11 items-center justify-center gap-2 rounded-[12px] bg-[#f84557] px-4 text-[14px] font-semibold text-white shadow-[0_10px_18px_rgba(248,69,87,0.18)] transition hover:bg-[#ea3248]">
            <Plus className="h-4 w-4" />
            Nouveau code promo
          </button>
        </div>
        {feedback ? <div className="mt-4 rounded-[12px] bg-[#f8fafc] px-4 py-3 text-[13px] font-medium text-[#344054]">{feedback}</div> : null}
      </section>

      <section className="space-y-4">
        {promoCodes.map((promoCode) => (
          <article key={promoCode.id} className="rounded-[18px] border border-[#e7ebf1] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
            <div className="grid gap-4 xl:grid-cols-3">
              <label className="space-y-2 text-[13px] font-semibold text-[#344054]">
                <span>Code</span>
                <input value={promoCode.code} onChange={(event) => updatePromoCode(promoCode.id, "code", event.target.value.toUpperCase())} className="h-11 w-full rounded-[12px] border border-[#dfe3ea] px-4 text-[14px] outline-none focus:border-[#f84557]" />
              </label>
              <label className="space-y-2 text-[13px] font-semibold text-[#344054]">
                <span>Libellé</span>
                <input value={promoCode.label} onChange={(event) => updatePromoCode(promoCode.id, "label", event.target.value)} className="h-11 w-full rounded-[12px] border border-[#dfe3ea] px-4 text-[14px] outline-none focus:border-[#f84557]" />
              </label>
              <label className="space-y-2 text-[13px] font-semibold text-[#344054]">
                <span>Type</span>
                <select value={promoCode.amountType} onChange={(event) => updatePromoCode(promoCode.id, "amountType", event.target.value as PromoCodeRecord["amountType"])} className="h-11 w-full rounded-[12px] border border-[#dfe3ea] bg-white px-4 text-[14px] outline-none focus:border-[#f84557]">
                  <option value="fixed_fcfa">Montant fixe FCFA</option>
                  <option value="percent">Pourcentage</option>
                </select>
              </label>
              <label className="space-y-2 text-[13px] font-semibold text-[#344054]">
                <span>Valeur</span>
                <input type="number" min={0} value={promoCode.amountValue} onChange={(event) => updatePromoCode(promoCode.id, "amountValue", Number(event.target.value || 0))} className="h-11 w-full rounded-[12px] border border-[#dfe3ea] px-4 text-[14px] outline-none focus:border-[#f84557]" />
              </label>
              <label className="space-y-2 text-[13px] font-semibold text-[#344054]">
                <span>Achat minimum FCFA</span>
                <input type="number" min={0} value={promoCode.minOrderFcfa} onChange={(event) => updatePromoCode(promoCode.id, "minOrderFcfa", Number(event.target.value || 0))} className="h-11 w-full rounded-[12px] border border-[#dfe3ea] px-4 text-[14px] outline-none focus:border-[#f84557]" />
              </label>
              <label className="space-y-2 text-[13px] font-semibold text-[#344054]">
                <span>Plafond remise FCFA</span>
                <input type="number" min={0} value={promoCode.maxDiscountFcfa ?? ""} onChange={(event) => updatePromoCode(promoCode.id, "maxDiscountFcfa", event.target.value ? Number(event.target.value) : undefined)} className="h-11 w-full rounded-[12px] border border-[#dfe3ea] px-4 text-[14px] outline-none focus:border-[#f84557]" />
              </label>
              <label className="space-y-2 text-[13px] font-semibold text-[#344054]">
                <span>Début ISO</span>
                <input value={promoCode.startsAt ?? ""} onChange={(event) => updatePromoCode(promoCode.id, "startsAt", event.target.value || undefined)} className="h-11 w-full rounded-[12px] border border-[#dfe3ea] px-4 text-[14px] outline-none focus:border-[#f84557]" />
              </label>
              <label className="space-y-2 text-[13px] font-semibold text-[#344054]">
                <span>Fin ISO</span>
                <input value={promoCode.endsAt ?? ""} onChange={(event) => updatePromoCode(promoCode.id, "endsAt", event.target.value || undefined)} className="h-11 w-full rounded-[12px] border border-[#dfe3ea] px-4 text-[14px] outline-none focus:border-[#f84557]" />
              </label>
              <label className="space-y-2 text-[13px] font-semibold text-[#344054]">
                <span>Limite d&apos;utilisation</span>
                <input type="number" min={0} value={promoCode.usageLimit ?? ""} onChange={(event) => updatePromoCode(promoCode.id, "usageLimit", event.target.value ? Number(event.target.value) : undefined)} className="h-11 w-full rounded-[12px] border border-[#dfe3ea] px-4 text-[14px] outline-none focus:border-[#f84557]" />
              </label>
              <label className="space-y-2 text-[13px] font-semibold text-[#344054] xl:col-span-3">
                <span>Description</span>
                <textarea value={promoCode.description ?? ""} onChange={(event) => updatePromoCode(promoCode.id, "description", event.target.value)} className="min-h-[96px] w-full rounded-[12px] border border-[#dfe3ea] px-4 py-3 text-[14px] outline-none focus:border-[#f84557]" />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <label className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#344054]">
                <input type="checkbox" checked={promoCode.active} onChange={(event) => updatePromoCode(promoCode.id, "active", event.target.checked)} className="h-4 w-4 rounded border-[#d0d5dd]" />
                Code actif
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <div className="rounded-full bg-[#f8fafc] px-3 py-1 text-[12px] font-semibold text-[#475467]">Utilisations: {promoCode.usageCount}</div>
                <button type="button" onClick={() => void savePromoCode(promoCode)} disabled={savingId === promoCode.id} className="inline-flex h-10 items-center justify-center gap-2 rounded-[12px] border border-[#d0d5dd] px-4 text-[13px] font-semibold text-[#101828] transition hover:border-[#f84557] hover:text-[#f84557] disabled:cursor-not-allowed disabled:opacity-60">
                  <Save className="h-4 w-4" />
                  {savingId === promoCode.id ? "Enregistrement..." : "Enregistrer"}
                </button>
                <button type="button" onClick={() => void deletePromoCode(promoCode)} className="inline-flex h-10 w-10 items-center justify-center rounded-[12px] bg-[#f84557] text-white transition hover:bg-[#ea3248]">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="mt-4 rounded-[14px] border border-[#e4e7ec] bg-[#fcfcfd] px-4 py-3">
              <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#667085]">Réception coupon</div>
              <div className="mt-2 break-all text-[13px] text-[#344054]">{buildReceivePath(promoCode.code || "CODE")}</div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void copyReceiveLink(promoCode)}
                  disabled={copyingId === promoCode.id}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-[10px] border border-[#d0d5dd] px-3 text-[12px] font-semibold text-[#101828] transition hover:border-[#f84557] hover:text-[#f84557] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Copy className="h-3.5 w-3.5" />
                  {copyingId === promoCode.id ? "Copie..." : "Copier le lien"}
                </button>
                <a href={buildReceivePath(promoCode.code || "")} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center justify-center gap-2 rounded-[10px] border border-[#d0d5dd] px-3 text-[12px] font-semibold text-[#101828] transition hover:border-[#f84557] hover:text-[#f84557]">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Ouvrir le lien
                </a>
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}