"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { MessageCircleMore } from "lucide-react";

type MessagesPopoverProps = {
  className?: string;
  align?: "left" | "center" | "right";
};

export function MessagesPopover({ className = "", align = "right" }: MessagesPopoverProps) {
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
        aria-label="Ouvrir les messages"
        onClick={togglePopover}
        className={["inline-flex items-center justify-center text-[#222] transition hover:text-[#ff6a00]", className].join(" ")}
      >
        <MessageCircleMore className="h-6 w-6" />
      </button>

      <div
        className={[
          "absolute top-[calc(100%+16px)] z-[130] w-[480px] rounded-[18px] border border-[#ececec] bg-white p-6 shadow-[0_22px_46px_rgba(0,0,0,0.15)] transition-all duration-150",
          alignmentClassName,
          isOpen ? "visible translate-y-0 opacity-100" : "invisible -translate-y-1 opacity-0",
        ].join(" ")}
      >
        <div className={["absolute -top-2 h-4 w-4 rotate-45 border-l border-t border-[#ececec] bg-white", arrowClassName].join(" ")} />
        <div className="text-[18px] font-semibold text-[#222]">Messages</div>

        <div className="flex flex-col items-center px-5 pb-2 pt-8 text-center">
          <div className="relative flex h-32 w-32 items-center justify-center rounded-full border-2 border-[#9aa28e] bg-[#fffdf7]">
            <div className="absolute left-[-14px] top-8 h-16 w-16 rotate-[-14deg] rounded-[14px] border-2 border-[#ff9d61] bg-white" />
            <div className="absolute right-0 top-4 flex h-20 w-20 items-center justify-center rounded-[26px] bg-[#ffb07c]">
              <div className="space-y-2 text-[#1d1d1d]">
                <div className="flex items-center justify-center gap-3">
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                </div>
                <div className="mx-auto h-4 w-8 rounded-b-full border-b-2 border-current" />
              </div>
            </div>
          </div>

          <p className="mt-6 text-[15px] text-[#444]">Discutez avec le service AfriPay et vos agents logistique dedies.</p>

          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {[
              "Zach Cargo",
              "Estrelia",
              "NIF cargo",
            ].map((agent) => (
              <span key={agent} className="rounded-full bg-[#fff3ea] px-3 py-1 text-[13px] font-semibold text-[#d85300]">
                {agent}
              </span>
            ))}
          </div>

          <Link
            href="/messages"
            className="mt-8 inline-flex h-14 w-full items-center justify-center rounded-full bg-[#ff6a00] px-6 text-[16px] font-semibold text-white transition hover:bg-[#ef6100]"
          >
            Ouvrir les discussions
          </Link>
        </div>
      </div>
    </div>
  );
}