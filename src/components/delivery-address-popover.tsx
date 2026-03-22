"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";

import { getMessages } from "@/lib/messages";
import { CURRENCY_OPTIONS, DELIVERY_COUNTRY_OPTIONS, type CurrencyCode } from "@/lib/pricing-options";

type DeliveryAddressPopoverProps = {
  countryCode: string;
  countryLabel: string;
  currencyCode: string;
  flagEmoji: string;
  className?: string;
  align?: "left" | "center" | "right";
  compact?: boolean;
  languageCode?: string;
};

export function DeliveryAddressPopover({
  countryCode,
  countryLabel,
  currencyCode,
  flagEmoji,
  className = "",
  align = "center",
  compact = false,
  languageCode,
}: DeliveryAddressPopoverProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState(countryCode);
  const [selectedCurrency, setSelectedCurrency] = useState(currencyCode as CurrencyCode);
  const [isPending, startTransition] = useTransition();
  const closeTimeoutRef = useRef<number | null>(null);
  const messages = getMessages(languageCode);

  useEffect(() => {
    setSelectedCountry(countryCode);
  }, [countryCode]);

  useEffect(() => {
    setSelectedCurrency(currencyCode as CurrencyCode);
  }, [currencyCode]);

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
    document.cookie = `afri_country=${selectedCountry}; Max-Age=${60 * 60 * 24 * 180}; Path=/; SameSite=Lax`;
    document.cookie = `afri_currency=${selectedCurrency}; Max-Age=${60 * 60 * 24 * 180}; Path=/; SameSite=Lax`;

    startTransition(() => {
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
          "text-left text-[#222]",
          compact ? "flex items-center gap-2" : "leading-tight",
        ].join(" ")}
      >
        {compact ? (
          <>
            <span className="text-[18px]">{flagEmoji}</span>
            <span className="font-semibold">{countryLabel}</span>
            <ChevronDown className="h-4 w-4" />
          </>
        ) : (
          <>
            <div className="text-[#555]">{messages.deliveryPopover.shippingAddress}</div>
            <div className="mt-1 flex items-center gap-2 font-semibold">
              <span>{flagEmoji}</span>
              <span>{countryLabel}</span>
              <ChevronDown className="h-4 w-4" />
            </div>
          </>
        )}
      </button>

      <div
        className={[
          "absolute top-[calc(100%+12px)] z-[120] w-[392px] rounded-[16px] border border-[#d9d9d9] bg-white p-5 shadow-[0_20px_40px_rgba(0,0,0,0.16)] transition-all duration-150",
          alignmentClassName,
          isOpen ? "visible translate-y-0 opacity-100" : "invisible -translate-y-1 opacity-0",
        ].join(" ")}
      >
        <div className={["absolute -top-2 h-4 w-4 rotate-45 border-l border-t border-[#d9d9d9] bg-white", arrowClassName].join(" ")} />

        <h3 className="text-[18px] font-bold tracking-[-0.03em] text-[#333]">{messages.deliveryPopover.title}</h3>
        <p className="mt-2 max-w-[320px] text-[14px] leading-7 text-[#4d4d4d]">
          {messages.deliveryPopover.description}
        </p>

        <button
          type="button"
          className="mt-5 flex h-11 w-full items-center justify-center rounded-full bg-[#ff6a00] px-6 text-[15px] font-semibold text-white hover:bg-[#ef6100]"
        >
          {messages.deliveryPopover.addAddress}
        </button>

        <div className="my-4 flex items-center gap-4 text-[13px] text-[#666]">
          <div className="h-px flex-1 bg-[#dfdfdf]" />
          <span>{messages.deliveryPopover.or}</span>
          <div className="h-px flex-1 bg-[#dfdfdf]" />
        </div>

        <div className="space-y-3">
          <label className="block text-[12px] font-semibold uppercase tracking-[0.12em] text-[#777]">
            {messages.deliveryPopover.country}
            <select
              value={selectedCountry}
              onChange={(event) => setSelectedCountry(event.target.value)}
              className="mt-2 h-11 w-full rounded-[8px] border border-[#d7dce5] bg-white px-4 text-[15px] font-medium text-[#333] outline-none focus:border-[#ff6a00]"
            >
              {DELIVERY_COUNTRY_OPTIONS.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.flagEmoji} {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-[12px] font-semibold uppercase tracking-[0.12em] text-[#777]">
            {messages.deliveryPopover.currency}
            <select
              value={selectedCurrency}
              onChange={(event) => setSelectedCurrency(event.target.value as CurrencyCode)}
              className="mt-2 h-11 w-full rounded-[8px] border border-[#d7dce5] bg-white px-4 text-[15px] font-medium text-[#333] outline-none focus:border-[#ff6a00]"
            >
              {CURRENCY_OPTIONS.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <button
          type="button"
          onClick={handleSave}
          className="mt-5 flex h-11 w-full items-center justify-center rounded-full bg-[#ff6a00] px-6 text-[15px] font-semibold text-white hover:bg-[#ef6100] disabled:cursor-not-allowed disabled:opacity-70"
          disabled={isPending}
        >
          {isPending ? messages.deliveryPopover.saving : messages.deliveryPopover.save}
        </button>
        <input type="hidden" value={countryCode} readOnly />
      </div>
    </div>
  );
}