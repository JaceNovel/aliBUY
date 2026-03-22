"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ShoppingCart } from "lucide-react";

type CartPopoverProps = {
  className?: string;
  align?: "left" | "center" | "right";
};

export function CartPopover({ className = "", align = "right" }: CartPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const closeTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        window.clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  const showPopover = () => {
    if (closeTimeoutRef.current) {
      window.clearTimeout(closeTimeoutRef.current);
    }

    setIsOpen(true);
  };

  const hidePopover = () => {
    if (closeTimeoutRef.current) {
      window.clearTimeout(closeTimeoutRef.current);
    }

    closeTimeoutRef.current = window.setTimeout(() => {
      setIsOpen(false);
    }, 120);
  };

  const togglePopover = () => {
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
    <div className="relative" onMouseEnter={showPopover} onMouseLeave={hidePopover}>
      <button
        type="button"
        aria-label="Ouvrir le panier"
        onClick={togglePopover}
        className={["inline-flex items-center justify-center text-[#222] transition hover:text-[#ff6a00]", className].join(" ")}
      >
        <ShoppingCart className="h-6 w-6" />
      </button>

      <div
        className={[
          "absolute top-[calc(100%+16px)] z-[130] w-[450px] rounded-[18px] border border-[#e7e7e7] bg-white p-6 shadow-[0_22px_46px_rgba(0,0,0,0.15)] transition-all duration-150",
          alignmentClassName,
          isOpen ? "visible translate-y-0 opacity-100" : "invisible -translate-y-1 opacity-0",
        ].join(" ")}
      >
        <div className={["absolute -top-2 h-4 w-4 rotate-45 border-l border-t border-[#e7e7e7] bg-white", arrowClassName].join(" ")} />
        <div className="text-[18px] font-semibold text-[#222]">Shopping cart</div>

        <div className="flex flex-col items-center px-6 pb-2 pt-6 text-center">
          <div className="relative h-24 w-24">
            <div className="absolute bottom-5 left-4 h-9 w-12 rounded-[8px] border border-[#d5b08a] bg-[linear-gradient(180deg,#f7d09f_0%,#e7b46f_100%)] shadow-[0_8px_18px_rgba(223,171,110,0.35)]" />
            <div className="absolute left-8 top-0 h-9 w-10 rotate-[34deg] rounded-sm border border-[#d7d7d7] bg-white" />
            <div className="absolute left-10 top-7 h-2 w-7 rounded-full bg-[#8d6a42]" />
            <div className="absolute bottom-2 left-5 h-4 w-4 rounded-full border border-[#9d9d9d] bg-white" />
            <div className="absolute bottom-2 right-5 h-4 w-4 rounded-full border border-[#9d9d9d] bg-white" />
            <div className="absolute right-2 top-2 h-14 w-1 rotate-[35deg] rounded-full bg-[#b3b3b3]" />
          </div>

          <div className="mt-3 text-[18px] font-semibold text-[#222]">Votre panier est vide</div>

          <Link
            href="/favorites"
            className="mt-7 inline-flex h-12 w-full items-center justify-center rounded-full border border-[#222] px-6 text-[16px] font-semibold text-[#222] transition hover:border-[#ff6a00] hover:text-[#ff6a00]"
          >
            Acceder au panier
          </Link>
        </div>
      </div>
    </div>
  );
}