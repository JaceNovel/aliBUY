import Link from "next/link";
import { ArrowUpRight, Boxes, DollarSign, Package, ShoppingCart, Users } from "lucide-react";

import { adminNavItems } from "@/lib/admin-config";
import { getAdminMetrics, getAdminMonthlyRevenue, getAdminRecentOrders } from "@/lib/admin-data";
import { getPricingContext } from "@/lib/pricing";

function buildChartPath(values: number[]) {
  const width = 520;
  const height = 220;
  const maxValue = Math.max(...values, 1);

  return values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width;
      const y = height - (value / maxValue) * 170 - 20;
      return `${index === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");
}

export default async function AdminPage() {
  const pricing = await getPricingContext();
  const [metrics, monthlyRevenue, recentOrders] = await Promise.all([
    getAdminMetrics(),
    getAdminMonthlyRevenue(),
    getAdminRecentOrders(5),
  ]);
  const chartValues = monthlyRevenue.map((entry) => entry.value);
  const chartPath = buildChartPath(chartValues);
  const dashboardCards = [
    {
      label: "Revenu Total",
      value: pricing.formatPrice(metrics.revenueUsd),
      icon: DollarSign,
      accent: "bg-[#e9f0ff] text-[#2b67f6]",
      href: "/admin/offers",
    },
    {
      label: "Total des Commandes",
      value: String(metrics.ordersCount),
      icon: ShoppingCart,
      accent: "bg-[#e8fbef] text-[#15a34a]",
      href: "/admin/orders",
    },
    {
      label: "Total des Produits",
      value: String(metrics.productsCount),
      icon: Package,
      accent: "bg-[#fff0df] text-[#f97316]",
      href: "/admin/products",
    },
    {
      label: "Total des Utilisateurs",
      value: String(metrics.suppliersCount),
      icon: Users,
      accent: "bg-[#f3e8ff] text-[#9333ea]",
      href: "/admin/users",
    },
  ];

  return (
    <div className="space-y-5">
      <section>
        <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#ff6a5b]">Admin panel</div>
        <h1 className="mt-2 text-[34px] font-black tracking-[-0.05em] text-[#ff5b4d]">Tableau de bord administratif</h1>
        <p className="mt-1 text-[17px] text-[#516173]">Vue basee sur les utilisateurs, demandes et commandes reelles du projet.</p>
      </section>

      <section className="grid gap-4 xl:grid-cols-4">
        {dashboardCards.map((card) => {
          const Icon = card.icon;

          return (
            <Link key={card.label} href={card.href} className="rounded-[18px] border border-[#e6eaf0] bg-white px-5 py-5 shadow-[0_8px_22px_rgba(17,24,39,0.05)] transition hover:-translate-y-1 hover:shadow-[0_16px_30px_rgba(17,24,39,0.1)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[14px] font-medium text-[#667085]">{card.label}</div>
                  <div className="mt-2 text-[28px] font-black tracking-[-0.04em] text-[#111827]">{card.value}</div>
                  <div className="mt-1 text-[13px] font-semibold text-[#22c55e]">↑ 0.0%</div>
                </div>
                <div className={[("flex h-12 w-12 items-center justify-center rounded-full"), card.accent].join(" ")}>
                  <Icon className="h-6 w-6" />
                </div>
              </div>
            </Link>
          );
        })}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_1fr]">
        <article className="overflow-hidden rounded-[18px] border border-[#e6eaf0] bg-white shadow-[0_8px_22px_rgba(17,24,39,0.05)]">
          <div className="border-b border-[#edf1f6] px-5 py-4 text-[18px] font-bold text-[#1f2937]">Apercu des Revenus</div>
          <div className="px-5 py-4">
            <svg viewBox="0 0 520 240" className="h-[220px] w-full">
              {[0, 1, 2, 3, 4].map((line) => (
                <line key={line} x1="0" y1={20 + line * 40} x2="520" y2={20 + line * 40} stroke="#eef1f5" strokeWidth="1" />
              ))}
              <path d={chartPath} fill="none" stroke="#2b67f6" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              {chartValues.map((value, index) => {
                const x = (index / Math.max(chartValues.length - 1, 1)) * 520;
                const maxValue = Math.max(...chartValues, 1);
                const y = 220 - (value / maxValue) * 170 - 20;

                return <circle key={`${monthlyRevenue[index]?.label}-${value}`} cx={x} cy={y} r="5" fill="#2b67f6" />;
              })}
              {monthlyRevenue.map((entry, index) => (
                <text key={entry.label} x={(index / Math.max(monthlyRevenue.length - 1, 1)) * 520} y="236" textAnchor="middle" fontSize="14" fill="#667085">
                  {entry.label}
                </text>
              ))}
            </svg>
          </div>
        </article>

        <article className="overflow-hidden rounded-[18px] border border-[#e6eaf0] bg-white shadow-[0_8px_22px_rgba(17,24,39,0.05)]">
          <div className="border-b border-[#edf1f6] px-5 py-4 text-[18px] font-bold text-[#1f2937]">Commandes Recentes</div>
          <div className="overflow-x-auto px-5 py-3">
            <table className="min-w-full text-left">
              <thead>
                <tr className="text-[13px] text-[#667085]">
                  <th className="py-3 pr-4 font-medium">ID de commande</th>
                  <th className="py-3 pr-4 font-medium">Client</th>
                  <th className="py-3 pr-4 font-medium">Produit</th>
                  <th className="py-3 pr-4 font-medium">Date</th>
                  <th className="py-3 pr-4 font-medium">Montant</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id} className="border-t border-[#edf1f6] align-top text-[13px] text-[#1f2937]">
                    <td className="py-4 pr-4 font-semibold"><Link href={order.href} className="transition hover:text-[#ff6a5b]">{order.id}</Link></td>
                    <td className="py-4 pr-4">{order.customer}</td>
                    <td className="py-4 pr-4 max-w-[220px]">{order.product}</td>
                    <td className="py-4 pr-4">{order.date}</td>
                    <td className="py-4 pr-4 font-semibold">{pricing.formatPrice(order.totalUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        {adminNavItems.slice(0, 6).map((item) => (
          <Link key={item.slug} href={item.href} className="rounded-[18px] border border-[#e6eaf0] bg-white px-5 py-5 shadow-[0_8px_22px_rgba(17,24,39,0.05)] transition hover:-translate-y-1 hover:shadow-[0_16px_30px_rgba(17,24,39,0.1)]">
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#ff6a5b]">Module admin</div>
            <div className="mt-3 flex items-center justify-between gap-4">
              <div>
                <div className="text-[22px] font-black tracking-[-0.04em] text-[#1f2937]">{item.label}</div>
                <p className="mt-2 max-w-[320px] text-[13px] leading-6 text-[#667085]">{item.description}</p>
              </div>
              <ArrowUpRight className="h-5 w-5 text-[#98a2b3]" />
            </div>
          </Link>
        ))}
        <Link href="/admin/settings" className="rounded-[18px] border border-dashed border-[#d9dde5] bg-[#fafbff] px-5 py-5 shadow-[0_8px_22px_rgba(17,24,39,0.03)] transition hover:border-[#ff6a5b] hover:bg-white">
          <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#ff6a5b]">Pilotage</div>
          <div className="mt-3 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#eef2ff] text-[#4263eb]">
              <Boxes className="h-6 w-6" />
            </div>
            <div>
              <div className="text-[20px] font-black tracking-[-0.04em] text-[#1f2937]">Vue systeme</div>
              <div className="mt-1 text-[13px] text-[#667085]">Reliez localisation, support, promos et catalogue depuis un seul point.</div>
            </div>
          </div>
        </Link>
      </section>
    </div>
  );
}