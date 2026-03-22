"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Grid2x2, Heart, House, MessageCircleMore, UserRound } from "lucide-react";

const navItems = [
  { href: "/", label: "Accueil", icon: House },
  { href: "/products", label: "Produits", icon: Grid2x2 },
  { href: "/messages", label: "Messages", icon: MessageCircleMore },
  { href: "/favorites", label: "Favoris", icon: Heart },
  { href: "/account", label: "Compte", icon: UserRound },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-[90] border-t border-black/10 bg-white/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur md:hidden">
      <div className="grid grid-cols-5 gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = isActivePath(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "flex min-w-0 flex-col items-center justify-center gap-1 rounded-[14px] px-1 py-2 text-center transition",
                isActive ? "bg-[#fff3ea]" : "",
              ].join(" ")}
            >
              <Icon className={["h-[18px] w-[18px]", isActive ? "text-[#ff6a00]" : "text-[#444]"].join(" ")} />
              <span className={["line-clamp-1 text-[11px] font-medium", isActive ? "text-[#ff6a00]" : "text-[#444]"].join(" ")}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}