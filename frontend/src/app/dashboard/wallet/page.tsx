"use client";

import { useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Landmark } from "lucide-react";

import { Button } from "@/components/Button";
import { getWallet } from "@/lib/api";
import type { PartnerWallet } from "@/types/partner-dashboard";

function formatCfa(value: number) {
  return `${new Intl.NumberFormat("fr-FR").format(value)} CFA`;
}

export default function DashboardWalletPage() {
  const [wallet, setWallet] = useState<PartnerWallet | null>(null);

  useEffect(() => {
    let alive = true;
    getWallet().then((payload) => {
      if (alive) {
        setWallet(payload);
      }
    }).catch(() => undefined);

    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(99,102,241,0.18),rgba(15,23,42,0.95))] p-6 shadow-[0_30px_80px_rgba(2,6,23,0.45)] sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm uppercase tracking-[0.22em] text-[#a5b4fc]">Wallet</div>
          <div className="mt-3 text-[34px] font-black tracking-[-0.05em] text-white">{wallet ? formatCfa(wallet.balance) : "..."}</div>
          <p className="mt-2 max-w-xl text-sm text-[#cbd5e1]">Solde disponible pour retrait ou réconciliation financière de tes revenus API.</p>
        </div>
        <Button className="h-12 px-5">
          <Landmark className="h-4 w-4" />
          Withdraw
        </Button>
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