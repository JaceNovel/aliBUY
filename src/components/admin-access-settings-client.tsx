"use client";

import { Shield, Trash2, UserCog } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { ADMIN_ROLE_PRESETS, type AdminAccessRecord, type AdminRole } from "@/lib/admin-access-store";

type Props = {
  initialRecords: AdminAccessRecord[];
};

const roleOptions = Object.entries(ADMIN_ROLE_PRESETS) as Array<[AdminRole, { label: string; permissions: string[] }]>;

export function AdminAccessSettingsClient({ initialRecords }: Props) {
  const router = useRouter();
  const [records, setRecords] = useState(initialRecords);
  const [form, setForm] = useState({ id: "", email: "", displayName: "", role: "operations" as AdminRole, active: true });
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const resetForm = () => {
    setForm({ id: "", email: "", displayName: "", role: "operations", active: true });
  };

  const save = async () => {
    setIsSaving(true);
    setError(null);
    setFeedback(null);
    try {
      const response = await fetch("/api/admin/access", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.message || "Impossible d'enregistrer l'accès admin.");
      }

      setRecords((current) => {
        const hasExisting = current.some((entry) => entry.id === payload.id);
        return hasExisting
          ? current.map((entry) => entry.id === payload.id ? payload : entry)
          : [payload, ...current];
      });
      resetForm();
      setFeedback("Accès admin enregistré.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'enregistrer l'accès admin.");
    } finally {
      setIsSaving(false);
    }
  };

  const edit = (record: AdminAccessRecord) => {
    setForm({ id: record.id, email: record.email, displayName: record.displayName, role: record.role, active: record.active });
    setError(null);
    setFeedback(null);
  };

  const remove = async (id: string) => {
    setIsSaving(true);
    setError(null);
    setFeedback(null);
    try {
      const response = await fetch(`/api/admin/access/${id}`, { method: "DELETE" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.message || "Impossible de supprimer cet accès admin.");
      }

      setRecords((current) => current.filter((entry) => entry.id !== id));
      if (form.id === id) {
        resetForm();
      }
      setFeedback("Accès admin supprimé.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de supprimer cet accès admin.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="rounded-[18px] border border-[#e7ebf1] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
      <div className="flex flex-col gap-3 border-b border-[#edf1f6] pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-[18px] font-black text-[#101828]">Rôles et permissions admin</div>
          <p className="mt-1 text-[14px] text-[#667085]">Ajoutez de vrais comptes admin autorisés, avec rôle et activation contrôlée.</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-[#fff4ed] px-3 py-2 text-[12px] font-semibold text-[#ff6a00]">
          <Shield className="h-4 w-4" />
          {records.length} accès actifs ou archivés
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[340px_1fr]">
        <article className="rounded-[16px] bg-[#fbfcfe] p-4 ring-1 ring-[#edf1f6]">
          <div className="flex items-center gap-2 text-[15px] font-bold text-[#101828]">
            <UserCog className="h-4 w-4 text-[#ff6a00]" />
            {form.id ? "Modifier un accès" : "Ajouter un accès"}
          </div>

          <div className="mt-4 grid gap-4">
            <label className="text-[13px] font-semibold text-[#344054]">Adresse e-mail
              <input value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} className="mt-2 h-11 w-full rounded-[12px] border border-[#d7dce5] px-4 text-[14px] outline-none focus:border-[#ff6a00]" />
            </label>
            <label className="text-[13px] font-semibold text-[#344054]">Nom affiché
              <input value={form.displayName} onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))} className="mt-2 h-11 w-full rounded-[12px] border border-[#d7dce5] px-4 text-[14px] outline-none focus:border-[#ff6a00]" />
            </label>
            <label className="text-[13px] font-semibold text-[#344054]">Rôle
              <select value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as AdminRole }))} className="mt-2 h-11 w-full rounded-[12px] border border-[#d7dce5] bg-white px-4 text-[14px] outline-none focus:border-[#ff6a00]">
                {roleOptions.map(([role, meta]) => (
                  <option key={role} value={role}>{meta.label}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center justify-between gap-4 rounded-[12px] border border-[#e4e7ec] bg-white px-4 py-3 text-[14px] text-[#344054]">
              <span className="font-semibold">Accès actif</span>
              <input type="checkbox" checked={form.active} onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))} className="h-4 w-4 rounded border-[#d0d5dd] text-[#ff6a00] focus:ring-[#ff6a00]" />
            </label>
          </div>

          {error ? <div className="mt-4 rounded-[12px] bg-[#fff1f2] px-4 py-3 text-[13px] font-medium text-[#b42318]">{error}</div> : null}
          {feedback ? <div className="mt-4 rounded-[12px] bg-[#effbf2] px-4 py-3 text-[13px] font-medium text-[#1f7a39]">{feedback}</div> : null}

          <div className="mt-4 flex gap-3">
            <button type="button" onClick={() => void save()} disabled={isSaving} className="inline-flex h-11 items-center justify-center rounded-full bg-[#ff6a00] px-5 text-[14px] font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-70">
              {isSaving ? "Traitement..." : form.id ? "Mettre à jour" : "Ajouter"}
            </button>
            {form.id ? (
              <button type="button" onClick={resetForm} className="inline-flex h-11 items-center justify-center rounded-full border border-[#d0d5dd] px-5 text-[14px] font-semibold text-[#344054] transition hover:border-[#ff6a00] hover:text-[#ff6a00]">
                Annuler
              </button>
            ) : null}
          </div>
        </article>

        <article className="overflow-hidden rounded-[16px] border border-[#edf1f6]">
          <table className="min-w-full text-left">
            <thead className="bg-[#fbfcfe] text-[12px] uppercase tracking-[0.08em] text-[#667085]">
              <tr>
                <th className="px-4 py-3 font-semibold">Compte</th>
                <th className="px-4 py-3 font-semibold">Rôle</th>
                <th className="px-4 py-3 font-semibold">Permissions</th>
                <th className="px-4 py-3 font-semibold">Statut</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id} className="border-t border-[#edf1f6] align-top text-[14px] text-[#101828]">
                  <td className="px-4 py-4">
                    <div className="font-semibold">{record.displayName}</div>
                    <div className="text-[13px] text-[#667085]">{record.email}</div>
                  </td>
                  <td className="px-4 py-4">{ADMIN_ROLE_PRESETS[record.role].label}</td>
                  <td className="px-4 py-4 text-[13px] text-[#667085]">{record.permissions.join(", ")}</td>
                  <td className="px-4 py-4">
                    <span className={["inline-flex rounded-full px-3 py-1 text-[12px] font-semibold", record.active ? "bg-[#dcfae6] text-[#16a34a]" : "bg-[#eef2f6] text-[#475467]"].join(" ")}>{record.active ? "Actif" : "Inactif"}</span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => edit(record)} className="inline-flex h-9 items-center justify-center rounded-full border border-[#e4e7ec] px-4 text-[12px] font-semibold text-[#344054] transition hover:border-[#ff6a00] hover:text-[#ff6a00]">
                        Modifier
                      </button>
                      <button type="button" onClick={() => void remove(record.id)} className="inline-flex h-9 items-center justify-center gap-1 rounded-full border border-[#f1c5c8] px-4 text-[12px] font-semibold text-[#b42318] transition hover:bg-[#fff5f6]">
                        <Trash2 className="h-3.5 w-3.5" />
                        Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      </div>
    </section>
  );
}