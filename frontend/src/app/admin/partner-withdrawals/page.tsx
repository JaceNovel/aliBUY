"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/Button";
import { getAdminPartnerWithdrawals, updateAdminPartnerWithdrawal } from "@/lib/api";
import type { AdminPartnerWithdrawalRecord } from "@/types/partner-dashboard";

function formatCfa(value: number) {
  return `${new Intl.NumberFormat("fr-FR").format(value)} CFA`;
}

export default function AdminPartnerWithdrawalsPage() {
  const [items, setItems] = useState<AdminPartnerWithdrawalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);

  async function reload() {
    const payload = await getAdminPartnerWithdrawals();
    setItems(payload.items);
  }

  useEffect(() => {
    reload().catch(() => setMessage("Impossible de charger les retraits partenaire."))
      .finally(() => setLoading(false));
  }, []);

  async function runAction(id: string, action: "approve" | "reject") {
    try {
      setPendingActionId(id);
      setMessage(null);
      await updateAdminPartnerWithdrawal(id, action);
      await reload();
      setMessage(action === "approve" ? "Retrait approuve." : "Retrait rejete.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action impossible sur ce retrait.");
    } finally {
      setPendingActionId(null);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[20px] border border-[#e6eaf0] bg-white px-5 py-5 shadow-[0_8px_22px_rgba(17,24,39,0.05)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#ff6a5b]">Administration</div>
            <h1 className="mt-2 text-[30px] font-black tracking-[-0.05em] text-[#1f2937]">Retraits partenaire</h1>
            <p className="mt-2 max-w-[760px] text-[14px] leading-6 text-[#667085]">Visualise le solde actif du partenaire, les demandes en attente et les retraits deja traites. Un partenaire ne peut soumettre qu un retrait par periode de 7 jours.</p>
          </div>
          <div className="rounded-[14px] bg-[#fff2ed] px-4 py-3 text-[13px] font-semibold text-[#ff6a5b]">{items.length} retrait(s)</div>
        </div>
      </section>

      {message ? <div className="rounded-[18px] border border-[#ffd6bf] bg-[#fff6f0] px-4 py-3 text-[13px] text-[#d85300]">{message}</div> : null}

      <section className="overflow-hidden rounded-[20px] border border-[#e6eaf0] bg-white shadow-[0_8px_22px_rgba(17,24,39,0.05)]">
        <div className="border-b border-[#edf1f6] px-5 py-4 text-[18px] font-bold text-[#1f2937]">Demandes de retrait</div>
        <div className="overflow-x-auto px-5 py-3">
          <table className="min-w-full text-left">
            <thead>
              <tr className="text-[12px] uppercase tracking-[0.08em] text-[#98a2b3]">
                <th className="py-3 pr-4 font-semibold">Partenaire</th>
                <th className="py-3 pr-4 font-semibold">Solde actif</th>
                <th className="py-3 pr-4 font-semibold">Montant</th>
                <th className="py-3 pr-4 font-semibold">Mode</th>
                <th className="py-3 pr-4 font-semibold">Coordonnees</th>
                <th className="py-3 pr-4 font-semibold">Statut</th>
                <th className="py-3 pr-4 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td className="py-6 text-sm text-[#667085]" colSpan={7}>Chargement...</td></tr>
              ) : items.length === 0 ? (
                <tr><td className="py-6 text-sm text-[#667085]" colSpan={7}>Aucune demande de retrait.</td></tr>
              ) : items.map((item) => (
                <tr key={item.id} className="border-t border-[#edf1f6] align-top text-[13px] text-[#1f2937]">
                  <td className="py-3.5 pr-4 leading-6">
                    <div className="font-semibold">{item.partner.companyName}</div>
                    <div className="text-[#667085]">{item.partner.email}</div>
                  </td>
                  <td className="py-3.5 pr-4 leading-6">{formatCfa(item.partner.walletBalance)}</td>
                  <td className="py-3.5 pr-4 leading-6">{formatCfa(item.amount)}</td>
                  <td className="py-3.5 pr-4 leading-6">{item.method === "bank_transfer" ? "Virement bancaire" : "Mobile Money"}</td>
                  <td className="py-3.5 pr-4 leading-6 text-[#475467]">
                    {item.method === "bank_transfer"
                      ? `${item.bankName ?? "Banque"} · ${item.iban ?? "IBAN manquant"}`
                      : `${item.mobileMoneyCountryCode ?? "--"} · ${item.mobileMoneyOperator ?? "Operateur"} · ${item.mobileMoneyNumber ?? "Numero manquant"}`}
                  </td>
                  <td className="py-3.5 pr-4 leading-6">
                    <span className={[
                      "rounded-full px-3 py-1 text-xs font-semibold",
                      item.status === "approved"
                        ? "bg-[#ecfdf3] text-[#067647]"
                        : item.status === "rejected"
                          ? "bg-[#fef3f2] text-[#b42318]"
                          : "bg-[#fffaeb] text-[#b54708]",
                    ].join(" ")}>{item.status}</span>
                  </td>
                  <td className="py-3.5 pr-4 leading-6">
                    {item.status === "pending" ? (
                      <div className="flex flex-wrap gap-2">
                        <Button variant="secondary" className="h-9 rounded-[14px] px-4" disabled={pendingActionId === item.id} onClick={() => runAction(item.id, "approve")}>Approuver</Button>
                        <Button variant="ghost" className="h-9 rounded-[14px] px-4" disabled={pendingActionId === item.id} onClick={() => runAction(item.id, "reject")}>Rejeter</Button>
                      </div>
                    ) : (
                      <span className="text-[#667085]">Traite</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}