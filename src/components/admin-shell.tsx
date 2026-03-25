"use client";

import { useClerk } from "@clerk/nextjs";
import {
  BadgePercent,
  Bell,
  Boxes,
  ChevronDown,
  ChevronRight,
  FileText,
  Gift,
  Headset,
  LayoutDashboard,
  List,
  Mail,
  Menu,
  Package,
  Settings,
  ShipWheel,
  ShoppingCart,
  Star,
  TicketPercent,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { adminNavItems, adminNavSubItems, adminQuickLinks } from "@/lib/admin-config";

const iconMap = {
  users: Users,
  package: Package,
  list: List,
  "badge-percent": BadgePercent,
  "ticket-percent": TicketPercent,
  gift: Gift,
  mail: Mail,
  headset: Headset,
  "ship-wheel": ShipWheel,
  star: Star,
  settings: Settings,
  boxes: Boxes,
  "shopping-cart": ShoppingCart,
  "file-text": FileText,
};

type AdminShellProps = {
  children: React.ReactNode;
};

export function AdminShell({ children }: AdminShellProps) {
  const clerk = useClerk();
  const pathname = usePathname();
  const router = useRouter();

  const logout = async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "same-origin",
    });
    await clerk.signOut({ redirectUrl: "/login" }).catch(() => null);
    router.replace("/login");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-[#1d2738]">
      <div className="grid min-h-screen lg:grid-cols-[236px_1fr]">
        <aside className="border-r border-[#e6e9ef] bg-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
          <div className="flex h-[76px] shrink-0 items-center gap-3 border-b border-[#eef1f5] px-4">
            <Link href="/admin" className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[linear-gradient(135deg,#ffefde_0%,#ffd3b0_100%)] text-[11px] font-black uppercase tracking-[0.04em] text-[#ff5b2b]">
              AP
            </Link>
            <div>
              <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#ff6a3d]">AfriPay</div>
              <div className="text-[24px] font-black tracking-[-0.05em] text-[#ff5b4d]">Admin</div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
            <Link
              href="/admin"
              className={[
                "mb-1.5 flex items-center gap-3 rounded-[14px] px-3 py-2.5 text-[14px] font-semibold transition",
                pathname === "/admin" ? "bg-[#fff0ea] text-[#ff6234]" : "text-[#394456] hover:bg-[#f7f8fb]",
              ].join(" ")}
            >
              <LayoutDashboard className="h-4.5 w-4.5" />
              Tableau de bord
            </Link>

            <nav className="space-y-1">
              {adminNavItems.map((item) => {
                const Icon = iconMap[item.icon as keyof typeof iconMap];
                const subItems = adminNavSubItems[item.slug];
                const isGroup = Boolean(subItems?.length);
                const isGroupActive = isGroup ? pathname === item.href || pathname.startsWith(`${item.href}/`) : false;
                const isActive = isGroup ? isGroupActive : pathname === item.href;

                return (
                  <div key={item.slug} className="space-y-1">
                    <Link
                      href={item.href}
                      className={[
                        "flex items-center justify-between rounded-[14px] px-3 py-2.5 text-[14px] font-semibold transition",
                        isActive ? "bg-[#fff0ea] text-[#ff6234]" : "text-[#394456] hover:bg-[#f7f8fb]",
                      ].join(" ")}
                    >
                      <span className="flex items-center gap-3">
                        <Icon className="h-4.5 w-4.5" />
                        {item.label}
                      </span>
                      {isGroup ? (isGroupActive ? <ChevronDown className="h-4 w-4 text-[#ff6234]" /> : <ChevronRight className="h-4 w-4 text-[#7d8796]" />) : null}
                    </Link>

                    {isGroup && isGroupActive && subItems ? (
                      <div className="ml-8 space-y-1 border-l border-[#f0d6cb] pl-3">
                        {subItems.map((subItem) => {
                          const isSubActive = pathname === subItem.href;

                          return (
                            <Link
                              key={subItem.href}
                              href={subItem.href}
                              className={[
                                "flex items-center rounded-[12px] px-3 py-2 text-[13px] font-medium transition",
                                isSubActive ? "bg-[#eef4ff] text-[#3b82f6]" : "text-[#475467] hover:bg-[#f7f8fb]",
                              ].join(" ")}
                            >
                              {subItem.label}
                            </Link>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </nav>
          </div>

          <div className="mt-auto shrink-0 border-t border-[#eef1f5] px-4 py-4 text-[12px] text-[#556070]">
            Powered by Gestionnaire AfriPay
          </div>
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-20 flex h-[60px] items-center justify-between border-b border-[#e6e9ef] bg-white/92 px-4 backdrop-blur sm:px-6">
            <div className="flex items-center gap-3">
              <button type="button" className="flex h-9 w-9 items-center justify-center rounded-[12px] border border-[#e7e9ef] text-[#202938] transition hover:bg-[#f8f9fb]">
                <Menu className="h-4.5 w-4.5" />
              </button>
              <Link href="/products" className="flex h-9 items-center justify-center rounded-[12px] border border-[#e7e9ef] px-3 text-[12px] font-semibold text-[#202938] transition hover:bg-[#f8f9fb]">
                ⌘ K
              </Link>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              {adminQuickLinks.map((item) => {
                const Icon = iconMap[item.icon as keyof typeof iconMap];

                return (
                  <Link key={item.label} href={item.href} className="hidden rounded-[12px] border border-[#e7e9ef] px-3 py-2 text-[12px] font-semibold text-[#344054] transition hover:bg-[#f8f9fb] xl:inline-flex xl:items-center xl:gap-2">
                    <Icon className="h-3.5 w-3.5" />
                    {item.label}
                  </Link>
                );
              })}

              <Link href="/messages" className="relative flex h-9 w-9 items-center justify-center rounded-[12px] border border-[#e7e9ef] text-[#202938] transition hover:bg-[#f8f9fb]">
                <Bell className="h-4.5 w-4.5" />
                <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-[#ff3b30]" />
              </Link>
              <button type="button" onClick={logout} className="inline-flex h-9 items-center justify-center rounded-[12px] border border-[#e7e9ef] px-3 text-[12px] font-semibold text-[#202938] transition hover:bg-[#f8f9fb]">
                Deconnexion
              </button>
              <Link href="/account" className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-[#0b8b7d] text-[11px] font-black text-white shadow-[0_12px_24px_rgba(11,139,125,0.24)]">
                AP
              </Link>
            </div>
          </header>

          <main className="px-4 py-5 sm:px-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
