"use client";

import { useEffect, useState } from "react";
import { BarChart3, CreditCard, ShoppingBag } from "lucide-react";

import { StatCard } from "@/components/StatCard";
import { getDashboardStats } from "@/lib/api";
import type { PartnerDashboardStats } from "@/types/partner-dashboard";

function formatCfa(value: number) {
  return `${new Intl.NumberFormat("fr-FR").format(value)} CFA`;
}

function OverviewSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={`overview-skeleton-${index}`} className="h-36 rounded-2xl border border-white/10 bg-white/[0.04]" />
        ))}
      </div>
      <div className="h-[320px] rounded-2xl border border-white/10 bg-white/[0.04]" />
    </div>
  );
}

export default function DashboardOverviewPage() {
  const [stats, setStats] = useState<PartnerDashboardStats | null>(null);

  useEffect(() => {
    let alive = true;
    getDashboardStats().then((payload) => {
      if (alive) {
        setStats(payload);
      }
    }).catch(() => undefined);

    return () => {
      alive = false;
    };
  }, []);

  if (!stats) {
    return <OverviewSkeleton />;
  }

  const maxAmount = Math.max(...stats.revenueSeries.map((point) => point.amount), 1);

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-2">
        <div className="text-sm uppercase tracking-[0.24em] text-[#818cf8]">Overview</div>
        <h2 className="text-[32px] font-black tracking-[-0.05em] text-white">Revenus, commandes et cashflow en un coup d’œil</h2>
        <p className="max-w-2xl text-sm leading-7 text-[#8ea0c0]">Un cockpit compact pour piloter ton activité API comme une vraie plateforme SaaS: marge, wallet, cadence de commandes et performance journalière.</p>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <StatCard title="Balance" value={formatCfa(stats.balance)} detail="Disponible pour retrait" icon={CreditCard} accent="green" />
        <StatCard title="Orders" value={String(stats.ordersCount)} detail="Commandes traitées sur le cycle courant" icon={ShoppingBag} accent="indigo" />
        <StatCard title="Revenue" value={formatCfa(stats.revenueToday)} detail="Revenu généré aujourd’hui" icon={BarChart3} accent="amber" />
      </section>

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.94),rgba(15,23,42,0.78))] p-5 shadow-[0_30px_80px_rgba(2,6,23,0.45)]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium text-[#cbd5e1]">Revenus 7 jours</div>
            <div className="mt-1 text-sm text-[#64748b]">Projection de marge encaissée sur la dernière semaine.</div>
          </div>
          <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">+18.2%</div>
        </div>

        <div className="mt-8 grid grid-cols-7 gap-3">
          {stats.revenueSeries.map((point) => (
            <div key={point.day} className="flex flex-col items-center gap-3">
              <div className="flex h-52 w-full items-end rounded-[24px] bg-[linear-gradient(180deg,rgba(15,23,42,0.12),rgba(255,255,255,0.02))] px-2 py-2 ring-1 ring-white/5">
                <div
                  className="w-full rounded-[18px] bg-[linear-gradient(180deg,#818cf8_0%,#6366f1_50%,#22c55e_100%)] shadow-[0_18px_30px_rgba(99,102,241,0.35)] transition duration-300 hover:scale-[1.02]"
                  style={{ height: `${Math.max(18, (point.amount / maxAmount) * 100)}%` }}
                  aria-label={`${point.day} ${point.amount} CFA`}
                />
              </div>
              <div className="text-center">
                <div className="text-xs uppercase tracking-[0.14em] text-[#64748b]">{point.day}</div>
                <div className="mt-1 text-sm font-semibold text-white">{new Intl.NumberFormat("fr-FR").format(point.amount)}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}