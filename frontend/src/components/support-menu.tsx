"use client";

import Link from "next/link";
import { LifeBuoy, ReceiptText, ShieldAlert, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type SupportMenuProps = {
  triggerLabel?: string;
  className?: string;
  panelClassName?: string;
  align?: "left" | "center" | "right";
};

const supportCards = [
  {
    title: "Assistance commande",
    icon: ReceiptText,
    href: "/orders",
  },
  {
    title: "Assistance Rembousement",
    icon: LifeBuoy,
    href: "/account",
  },
];

const supportLinks = [
  "Ouvrir un litige",
  "Signaler une violation des Droits de Propriete Intellectuelle",
  "Signaler un abus",
];

export function SupportMenu({
  triggerLabel = "Centre d'assistance",
  className = "",
  panelClassName = "top-[calc(100%+12px)]",
  align = "right",
}: SupportMenuProps) {
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

  return (
    <div className="relative" onMouseEnter={showMenu} onMouseLeave={hideMenu}>
      <button type="button" onClick={toggleMenu} className={className}>
        {triggerLabel}
      </button>

      <div
        className={[
          "absolute z-[125] w-[980px] rounded-b-[10px] border border-[#e5e5e5] bg-white px-8 py-10 shadow-[0_22px_45px_rgba(0,0,0,0.12)] transition-all duration-150",
          alignmentClassName,
          panelClassName,
          isOpen ? "visible translate-y-0 opacity-100" : "invisible -translate-y-1 opacity-0",
        ].join(" ")}
      >
        <div className="grid gap-10 md:grid-cols-[1.15fr_0.95fr]">
          <div className="grid gap-5 sm:grid-cols-2">
            {supportCards.map((card) => {
              const Icon = card.icon;

              return (
                <Link
                  key={card.title}
                  href={card.href}
                  className="flex min-h-[162px] flex-col items-center justify-center rounded-[14px] border border-[#e6e6e6] px-6 text-center transition hover:border-[#ff6a00]/40 hover:bg-[#fffaf6]"
                >
                  <Icon className="h-10 w-10 text-[#222]" />
                  <div className="mt-5 text-[18px] text-[#222]">{card.title}</div>
                </Link>
              );
            })}
          </div>

          <div className="border-l border-[#ececec] pl-10">
            <div className="space-y-8 text-[18px] text-[#222]">
              <div className="flex items-center gap-4">
                <ShieldAlert className="h-5 w-5 text-[#222]" />
                <span>{supportLinks[0]}</span>
              </div>
              <div className="flex items-center gap-4 leading-8">
                <LifeBuoy className="h-5 w-5 shrink-0 text-[#222]" />
                <span>{supportLinks[1]}</span>
              </div>
              <div className="flex items-center gap-4">
                <TriangleAlert className="h-5 w-5 text-[#222]" />
                <span>{supportLinks[2]}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}