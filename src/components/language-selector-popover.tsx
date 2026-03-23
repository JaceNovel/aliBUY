"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Globe2 } from "lucide-react";

import { getMessages } from "@/lib/messages";
import { LANGUAGE_OPTIONS, type LanguageCode } from "@/lib/pricing-options";

type LanguageSelectorPopoverProps = {
  languageCode: string;
  languageLabel: string;
  className?: string;
  align?: "left" | "center" | "right";
  compact?: boolean;
};

export function LanguageSelectorPopover({
  languageCode,
  languageLabel,
  className = "",
  align = "center",
  compact = false,
}: LanguageSelectorPopoverProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [draftLanguage, setDraftLanguage] = useState<LanguageCode | null>(null);
  const [isPending, startTransition] = useTransition();
  const closeTimeoutRef = useRef<number | null>(null);
  const selectedLanguage = draftLanguage ?? (languageCode as LanguageCode);
  const messages = getMessages(languageCode);

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

  const handleSave = () => {
    document.cookie = `afri_language=${selectedLanguage}; Max-Age=${60 * 60 * 24 * 180}; Path=/; SameSite=Lax`;

    startTransition(() => {
      setDraftLanguage(null);
      setIsOpen(false);
      router.refresh();
    });
  };

  const alignmentClassName =
    align === "left"
      ? "left-0"
      : align === "right"
        ? "right-0"
        : "left-1/2 -translate-x-1/2";

  const arrowClassName =
    align === "left"
      ? "left-10"
      : align === "right"
        ? "right-10"
        : "left-1/2 -translate-x-1/2";

  return (
    <div
      className={["relative", className].join(" ")}
      onMouseEnter={showPopover}
      onMouseLeave={hidePopover}
    >
      <button
        type="button"
        onClick={togglePopover}
        className={[
          "flex items-center text-[#222]",
          compact
            ? "gap-2 rounded-full bg-white/70 px-3 py-2 text-[12px] font-semibold backdrop-blur-sm"
            : "gap-2 text-[16px]",
        ].join(" ")}
      >
        <Globe2 className={compact ? "h-3.5 w-3.5" : "h-5 w-5"} />
        <span className={compact ? "truncate" : ""}>{languageLabel}</span>
        <ChevronDown className="h-4 w-4" />
      </button>

      <div
        className={[
          "absolute top-[calc(100%+10px)] z-[120] rounded-[16px] border border-[#d9d9d9] bg-white shadow-[0_20px_40px_rgba(0,0,0,0.16)] transition-all duration-150",
          compact ? "w-[min(300px,calc(100vw-24px))] p-3.5" : "w-[300px] p-4",
          alignmentClassName,
          isOpen ? "visible translate-y-0 opacity-100" : "invisible -translate-y-1 opacity-0",
        ].join(" ")}
      >
        <div className={["absolute -top-2 h-4 w-4 rotate-45 border-l border-t border-[#d9d9d9] bg-white", arrowClassName].join(" ")} />
        <div className={compact ? "text-[16px] font-bold tracking-[-0.03em] text-[#333]" : "text-[18px] font-bold tracking-[-0.03em] text-[#333]"}>{messages.languagePopover.title}</div>
        <p className={compact ? "mt-1.5 text-[12px] leading-5 text-[#555]" : "mt-2 text-[14px] leading-6 text-[#555]"}>
          {messages.languagePopover.description}
        </p>

        <div className={compact ? "mt-3 space-y-2" : "mt-4 space-y-2"}>
          {LANGUAGE_OPTIONS.map((option) => (
            <button
              key={option.code}
              type="button"
              onClick={() => setDraftLanguage(option.code)}
              className={[
                compact
                  ? "flex w-full items-center justify-between rounded-[10px] border px-3 py-2.5 text-left text-[14px] transition-colors"
                  : "flex w-full items-center justify-between rounded-[10px] border px-4 py-3 text-left text-[15px] transition-colors",
                selectedLanguage === option.code
                  ? "border-[#ff6a00] bg-[#fff4eb] text-[#222]"
                  : "border-[#d7dce5] bg-white text-[#444] hover:border-[#ffb27c]",
              ].join(" ")}
            >
              <span>{option.label}</span>
              <span className="text-[12px] uppercase tracking-[0.12em] text-[#888]">{option.code}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={handleSave}
          className={compact ? "mt-3 flex h-10 w-full items-center justify-center rounded-full bg-[#ff6a00] px-5 text-[14px] font-semibold text-white hover:bg-[#ef6100] disabled:cursor-not-allowed disabled:opacity-70" : "mt-4 flex h-11 w-full items-center justify-center rounded-full bg-[#ff6a00] px-6 text-[15px] font-semibold text-white hover:bg-[#ef6100] disabled:cursor-not-allowed disabled:opacity-70"}
          disabled={isPending}
        >
          {isPending ? messages.languagePopover.applying : messages.languagePopover.apply}
        </button>
      </div>
    </div>
  );
}