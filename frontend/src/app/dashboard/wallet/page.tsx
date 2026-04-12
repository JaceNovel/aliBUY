"use client";

import { useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Landmark } from "lucide-react";

import { Button } from "@/components/Button";
import { getWallet, getWithdrawals, requestWithdrawal } from "@/lib/api";
import type { PartnerWallet, PartnerWithdrawalMethod, PartnerWithdrawalsResponse } from "@/types/partner-dashboard";

function formatCfa(value: number) {
  return `${new Intl.NumberFormat("fr-FR").format(value)} CFA`;
}

const mobileMoneyOptions: Record<string, string[]> = {
  TG: ["Mixx by Yas", "Flooz"],
  CI: ["Orange Money", "MTN Money", "Moov Money"],
  SN: ["Orange Money", "Wave", "Free Money"],
  CM: ["Orange Money", "MTN Mobile Money"],
  BJ: ["MTN Mobile Money", "Moov Money"],
};

export default function DashboardWalletPage() {
  const [wallet, setWallet] = useState<PartnerWallet | null>(null);
  const [withdrawals, setWithdrawals] = useState<PartnerWithdrawalsResponse | null>(null);
  const [method, setMethod] = useState<PartnerWithdrawalMethod>("bank_transfer");
  const [amount, setAmount] = useState("");
  const [bankAccountName, setBankAccountName] = useState("");
  const [bankName, setBankName] = useState("");
  const [iban, setIban] = useState("");
  const [swiftCode, setSwiftCode] = useState("");
  const [mobileMoneyNumber, setMobileMoneyNumber] = useState("");
  const [mobileMoneyCountryCode, setMobileMoneyCountryCode] = useState("TG");
  const [mobileMoneyOperator, setMobileMoneyOperator] = useState(mobileMoneyOptions.TG?.[0] ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([getWallet(), getWithdrawals()]).then(([walletPayload, withdrawalPayload]) => {
      if (alive) {
        setWallet(walletPayload);
        setWithdrawals(withdrawalPayload);
      }
    }).catch(() => undefined);

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const nextOperator = mobileMoneyOptions[mobileMoneyCountryCode]?.[0] ?? "";
    setMobileMoneyOperator((current) => current && mobileMoneyOptions[mobileMoneyCountryCode]?.includes(current) ? current : nextOperator);
  }, [mobileMoneyCountryCode]);

  async function submitWithdrawal() {
    const parsedAmount = Number(amount.replace(/\s+/g, "").replace(",", "."));
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setFormMessage("Saisis un montant de retrait valide.");
      return;
    }

    try {
      setSubmitting(true);
      setFormMessage(null);
      const payload = await requestWithdrawal({
        amount: parsedAmount,
        method,
        bankAccountName,
        bankName,
        iban,
        swiftCode,
        mobileMoneyNumber,
        mobileMoneyCountryCode,
        mobileMoneyOperator,
      });
      setWithdrawals(payload);
      setAmount("");
      setBankAccountName("");
      setBankName("");
      setIban("");
      setSwiftCode("");
      setMobileMoneyNumber("");
      setFormMessage("Demande envoyee. Un virement bancaire peut prendre jusqu a 3 jours et le mobile money jusqu a 24h.");
      const refreshedWallet = await getWallet();
      setWallet(refreshedWallet);
    } catch (error) {
      setFormMessage(error instanceof Error ? error.message : "Impossible d envoyer la demande de retrait.");
    } finally {
      setSubmitting(false);
    }
  }

  const approvedWithdrawals = withdrawals?.items.filter((item) => item.status === "approved") ?? [];
  const pendingWithdrawals = withdrawals?.items.filter((item) => item.status === "pending") ?? [];

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(99,102,241,0.18),rgba(15,23,42,0.95))] p-6 shadow-[0_30px_80px_rgba(2,6,23,0.45)] sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm uppercase tracking-[0.22em] text-[#a5b4fc]">Wallet</div>
          <div className="mt-3 text-[34px] font-black tracking-[-0.05em] text-white">{wallet ? formatCfa(wallet.balance) : "..."}</div>
          <p className="mt-2 max-w-xl text-sm text-[#cbd5e1]">Solde actif disponible pour retrait. Une demande maximum par semaine. Delai indicatif: 3 jours pour virement, 24h pour mobile money.</p>
        </div>
        <Button className="h-12 px-5" onClick={() => document.getElementById("withdrawal-form")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
          <Landmark className="h-4 w-4" />
          Demander un retrait
        </Button>
      </section>

      <section id="withdrawal-form" className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="text-base font-semibold text-white">Nouvelle demande</div>
          <p className="mt-2 text-sm leading-7 text-[#8ea0c0]">Choisis le mode de retrait adapte a ton pays. Les operateurs Mobile Money sont filtres par pays emetteur.</p>

          <div className="mt-5 flex gap-2 rounded-2xl border border-white/10 bg-[#0d162d] p-2">
            {[
              { value: "bank_transfer", label: "Virement bancaire" },
              { value: "mobile_money", label: "Mobile Money" },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setMethod(option.value as PartnerWithdrawalMethod)}
                className={[
                  "flex-1 rounded-[14px] px-4 py-3 text-sm font-semibold transition",
                  method === option.value ? "bg-[#6366f1] text-white" : "text-[#94a3b8] hover:bg-white/[0.04] hover:text-white",
                ].join(" ")}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="mt-5 space-y-4">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-[#cbd5e1]">Montant a retirer</span>
              <input value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="15000" className="h-12 w-full rounded-2xl border border-white/10 bg-[#111a31] px-4 text-sm text-white outline-none transition placeholder:text-[#64748b] focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/30" />
            </label>

            {method === "bank_transfer" ? (
              <>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-[#cbd5e1]">Titulaire du compte</span>
                  <input value={bankAccountName} onChange={(event) => setBankAccountName(event.target.value)} className="h-12 w-full rounded-2xl border border-white/10 bg-[#111a31] px-4 text-sm text-white outline-none transition focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/30" />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-[#cbd5e1]">Banque</span>
                  <input value={bankName} onChange={(event) => setBankName(event.target.value)} className="h-12 w-full rounded-2xl border border-white/10 bg-[#111a31] px-4 text-sm text-white outline-none transition focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/30" />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-[#cbd5e1]">IBAN</span>
                  <input value={iban} onChange={(event) => setIban(event.target.value)} className="h-12 w-full rounded-2xl border border-white/10 bg-[#111a31] px-4 text-sm text-white outline-none transition focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/30" />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-[#cbd5e1]">SWIFT / BIC</span>
                  <input value={swiftCode} onChange={(event) => setSwiftCode(event.target.value)} className="h-12 w-full rounded-2xl border border-white/10 bg-[#111a31] px-4 text-sm text-white outline-none transition focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/30" />
                </label>
              </>
            ) : (
              <>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-[#cbd5e1]">Pays emetteur</span>
                  <select value={mobileMoneyCountryCode} onChange={(event) => setMobileMoneyCountryCode(event.target.value)} className="h-12 w-full rounded-2xl border border-white/10 bg-[#111a31] px-4 text-sm text-white outline-none transition focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/30">
                    {Object.keys(mobileMoneyOptions).map((countryCode) => (
                      <option key={countryCode} value={countryCode}>{countryCode}</option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-[#cbd5e1]">Operateur</span>
                  <select value={mobileMoneyOperator} onChange={(event) => setMobileMoneyOperator(event.target.value)} className="h-12 w-full rounded-2xl border border-white/10 bg-[#111a31] px-4 text-sm text-white outline-none transition focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/30">
                    {(mobileMoneyOptions[mobileMoneyCountryCode] ?? []).map((operator) => (
                      <option key={operator} value={operator}>{operator}</option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-[#cbd5e1]">Numero Mobile Money</span>
                  <input value={mobileMoneyNumber} onChange={(event) => setMobileMoneyNumber(event.target.value)} placeholder="+228 90 00 00 00" className="h-12 w-full rounded-2xl border border-white/10 bg-[#111a31] px-4 text-sm text-white outline-none transition focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/30" />
                </label>
              </>
            )}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button onClick={submitWithdrawal} disabled={submitting || !withdrawals?.canRequest}>
              <Landmark className="h-4 w-4" />
              {submitting ? "Envoi..." : "Envoyer la demande"}
            </Button>
            {!withdrawals?.canRequest && withdrawals?.nextEligibleAt ? (
              <div className="text-xs text-[#fca5a5]">Prochaine demande possible le {new Date(withdrawals.nextEligibleAt).toLocaleString("fr-FR")}</div>
            ) : null}
          </div>
          {formMessage ? <div className="mt-4 rounded-2xl border border-white/10 bg-[#0d162d] px-4 py-3 text-sm text-[#cbd5e1]">{formMessage}</div> : null}
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="text-base font-semibold text-white">Retraits en attente</div>
            <div className="mt-4 space-y-3">
              {pendingWithdrawals.length > 0 ? pendingWithdrawals.map((item) => (
                <div key={item.id} className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-4 text-sm text-[#fde68a]">
                  <div className="font-semibold text-white">{formatCfa(item.amount)} via {item.method === "bank_transfer" ? "virement bancaire" : item.mobileMoneyOperator ?? "Mobile Money"}</div>
                  <div className="mt-2 text-xs text-[#fde68a]">Demande du {item.createdAt ? new Date(item.createdAt).toLocaleString("fr-FR") : "-"}. Traitement estime: {item.estimatedProcessingDelayHours}h.</div>
                </div>
              )) : <div className="rounded-2xl border border-white/8 bg-[#0d162d] px-4 py-4 text-sm text-[#8ea0c0]">Aucun retrait en attente.</div>}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="text-base font-semibold text-white">Retraits approuves</div>
            <div className="mt-4 space-y-3">
              {approvedWithdrawals.length > 0 ? approvedWithdrawals.map((item) => (
                <div key={item.id} className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-4 text-sm text-[#bbf7d0]">
                  <div className="font-semibold text-white">{formatCfa(item.amount)} approuve</div>
                  <div className="mt-2 text-xs text-[#bbf7d0]">{item.processedAt ? `Valide le ${new Date(item.processedAt).toLocaleString("fr-FR")}` : "Validation en cours"}{item.adminNote ? ` · ${item.adminNote}` : ""}</div>
                </div>
              )) : <div className="rounded-2xl border border-white/8 bg-[#0d162d] px-4 py-4 text-sm text-[#8ea0c0]">Aucun retrait approuve pour le moment.</div>}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="text-base font-semibold text-white">Historique transactions</div>
        <div className="mt-5 space-y-3">
          {!wallet ? <div className="h-40 animate-pulse rounded-2xl bg-white/[0.04]" /> : wallet.transactions.map((transaction) => (
            <div key={transaction.id} className="flex items-center justify-between gap-4 rounded-2xl border border-white/8 bg-[#0d162d] px-4 py-4">
              <div className="flex items-center gap-3">
                <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${transaction.type === "credit" ? "bg-[#22c55e]/15 text-[#86efac]" : "bg-[#f97316]/15 text-[#fdba74]"}`}>
                  {transaction.type === "credit" ? <ArrowDownLeft className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
                </div>
                <div>
                  <div className="font-medium text-white">{transaction.description}</div>
                  <div className="mt-1 text-xs text-[#64748b]">{new Date(transaction.createdAt).toLocaleString("fr-FR")}</div>
                </div>
              </div>
              <div className={`text-sm font-semibold ${transaction.type === "credit" ? "text-[#86efac]" : "text-[#fdba74]"}`}>
                {transaction.type === "credit" ? "+" : "-"}{formatCfa(transaction.amount)}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}