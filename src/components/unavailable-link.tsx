"use client";

import { useEffect, useRef, useState } from "react";

type UnavailableLinkProps = {
  label: string;
  message?: string;
  className?: string;
  tooltipClassName?: string;
};

export function UnavailableLink({
  label,
  message = "L'application n'est pas encore disponible",
  className = "",
  tooltipClassName = "left-1/2 top-[calc(100%+10px)] -translate-x-1/2",
}: UnavailableLinkProps) {
  const [isOpen, setIsOpen] = useState(false);
  const closeTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        window.clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  const showTooltip = () => {
    if (closeTimeoutRef.current) {
      window.clearTimeout(closeTimeoutRef.current);
    }

    setIsOpen(true);
  };

  const hideTooltip = () => {
    if (closeTimeoutRef.current) {
      window.clearTimeout(closeTimeoutRef.current);
    }

    closeTimeoutRef.current = window.setTimeout(() => {
      setIsOpen(false);
    }, 120);
  };

  const handleClick = () => {
    if (closeTimeoutRef.current) {
      window.clearTimeout(closeTimeoutRef.current);
    }

    setIsOpen((current) => !current);
  };

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      <button type="button" onClick={handleClick} className={className}>
        {label}
      </button>
      <div
        className={[
          "pointer-events-none absolute z-[80] w-max max-w-[260px] rounded-[12px] bg-[#222] px-4 py-2 text-[13px] font-medium text-white shadow-[0_16px_32px_rgba(0,0,0,0.22)] transition-all duration-150",
          tooltipClassName,
          isOpen ? "visible translate-y-0 opacity-100" : "invisible -translate-y-1 opacity-0",
        ].join(" ")}
      >
        {message}
      </div>
    </div>
  );
}