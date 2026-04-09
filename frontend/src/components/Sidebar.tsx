"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Cable, CreditCard, LayoutDashboard, Settings, ShoppingBag, X } from "lucide-react";

type SidebarProps = {
  open: boolean;
  onClose: () => void;
};

const navigationItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/orders", label: "Orders", icon: ShoppingBag },
  { href: "/dashboard/wallet", label: "Wallet", icon: CreditCard },
  { href: "/dashboard/api", label: "API Keys", icon: Cable },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      <div className={`fixed inset-0 z-30 bg-[#020617]/70 backdrop-blur-sm transition md:hidden ${open ? "opacity-100" : "pointer-events-none opacity-0"}`} onClick={onClose} />
      <aside className={`fixed inset-y-0 left-0 z-40 w-[280px] border-r border-white/10 bg-[radial-gradient(circle_at_top,#1e293b_0%,#0f172a_52%,#020617_100%)] px-5 py-6 shadow-[0_30px_80px_rgba(2,6,23,0.7)] transition md:static md:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between md:hidden">
          <div className="text-sm font-semibold uppercase tracking-[0.24em] text-[#818cf8]">AfriPay</div>
          <button type="button" onClick={onClose} className="rounded-2xl border border-white/10 p-2 text-[#94a3b8]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 md:mt-0">
          <Image
            src="/WhatsApp_Image_2026-03-22_at_03.03.05-removebg-preview.png"
            alt="AfriPay"
            width={54}
            height={54}
            className="h-[54px] w-auto object-contain"
            priority
          />
        </div>

        <nav className="mt-8 space-y-2">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={[
                  "group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition",
                  active
                    ? "bg-[#6366f1] text-white shadow-[0_18px_40px_rgba(99,102,241,0.35)]"
                    : "text-[#94a3b8] hover:bg-white/[0.06] hover:text-white",
                ].join(" ")}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.05] p-4 text-sm text-[#8ea0c0]">
          <div className="font-semibold text-white">Mode partenaire</div>
          <p className="mt-2 leading-6">Surveille les revenus API, la marge par commande et la santé de tes intégrations depuis un seul cockpit.</p>
        </div>
      </aside>
    </>
  );
}