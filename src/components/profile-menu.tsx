"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { User } from "lucide-react";

type ProfileMenuProps = {
  className?: string;
  align?: "left" | "center" | "right";
  userName?: string;
};

const profileItems = [
  { label: "Profil", href: "/account" },
  { label: "Commandes", href: "/orders" },
  { label: "Messages", href: "/messages" },
  { label: "Demandes de devis", href: "/quotes" },
  { label: "Favoris", href: "/favorites" },
  { label: "Compte", href: "/account" },
];

export function ProfileMenu({ className = "", align = "right", userName = "jace" }: ProfileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const closeTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        window.clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  const showMenu = () => {
    if (closeTimeoutRef.current) {
      window.clearTimeout(closeTimeoutRef.current);
    }

    setIsOpen(true);
  };

  const hideMenu = () => {
    if (closeTimeoutRef.current) {
      window.clearTimeout(closeTimeoutRef.current);
    }

    closeTimeoutRef.current = window.setTimeout(() => {
      setIsOpen(false);
    }, 120);
  };

  const toggleMenu = () => {
    if (closeTimeoutRef.current) {
      window.clearTimeout(closeTimeoutRef.current);
    }

    setIsOpen((current) => !current);
  };

  const alignmentClassName =
    align === "left"
      ? "left-0"
      : align === "right"
        ? "right-0"
        : "left-1/2 -translate-x-1/2";

  const arrowClassName =
    align === "left"
      ? "left-6"
      : align === "right"
        ? "right-6"
        : "left-1/2 -translate-x-1/2";

  return (
    <div className="relative" onMouseEnter={showMenu} onMouseLeave={hideMenu}>
      <button
        type="button"
        aria-label="Ouvrir le menu profil"
        onClick={toggleMenu}
        className={["inline-flex items-center justify-center text-[#222] transition hover:text-[#ff6a00]", className].join(" ")}
      >
        <User className="h-6 w-6" />
      </button>

      <div
        className={[
          "absolute top-[calc(100%+16px)] z-[130] w-[404px] rounded-[18px] border border-[#e6e6e6] bg-white px-6 py-5 shadow-[0_22px_46px_rgba(0,0,0,0.15)] transition-all duration-150",
          alignmentClassName,
          isOpen ? "visible translate-y-0 opacity-100" : "invisible -translate-y-1 opacity-0",
        ].join(" ")}
      >
        <div className={["absolute -top-2 h-4 w-4 rotate-45 border-l border-t border-[#e6e6e6] bg-white", arrowClassName].join(" ")} />

        <div className="flex items-center gap-3 border-b border-[#ededed] pb-5">
          <div className="text-[18px] font-semibold text-[#222]">Bonjour, {userName}</div>
          <span className="inline-flex rounded-sm bg-[#2ca5c5] px-2 py-0.5 text-[12px] font-semibold text-white">Seed</span>
        </div>

        <div className="space-y-1 py-5">
          {profileItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="block rounded-[12px] px-2 py-2 text-[18px] text-[#222] transition hover:bg-[#f7f7f7]"
            >
              {item.label}
            </Link>
          ))}
        </div>

        <div className="border-t border-[#ededed] pt-5">
          <button type="button" className="text-[18px] text-[#222] transition hover:text-[#ff6a00]">
            Se deconnecter
          </button>
        </div>
      </div>
    </div>
  );
}