"use client";

import { useEffect, useState } from "react";
import { Copy, Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/Button";
import { Input } from "@/components/Input";

type CopyFieldProps = {
  label: string;
  value: string;
  maskedValue?: string;
  revealable?: boolean;
  hint?: string;
  copyValue?: string;
  copyDisabled?: boolean;
};

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const input = document.createElement("textarea");
  input.value = value;
  input.setAttribute("readonly", "true");
  input.style.position = "fixed";
  input.style.left = "-9999px";
  document.body.appendChild(input);
  input.select();

  const copied = document.execCommand("copy");
  document.body.removeChild(input);

  if (!copied) {
    throw new Error("Copie indisponible.");
  }
}

export function CopyField({ label, value, maskedValue, revealable = false, hint, copyValue, copyDisabled = false }: CopyFieldProps) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const canReveal = revealable && Boolean(maskedValue) && value !== maskedValue;
  const canCopy = !copyDisabled && typeof (copyValue ?? value) === "string" && (copyValue ?? value).trim().length > 0;

  useEffect(() => {
    if (!copied) {
      return undefined;
    }

    const timeout = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  useEffect(() => {
    if (!copyError) {
      return undefined;
    }

    const timeout = window.setTimeout(() => setCopyError(false), 2200);
    return () => window.clearTimeout(timeout);
  }, [copyError]);

  const displayValue = canReveal && !revealed && maskedValue ? maskedValue : value;

  return (
    <div className="relative rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Input label={label} readOnly value={displayValue} hint={hint} className="pr-28" />
        </div>
        <div className="flex shrink-0 items-center gap-2 pt-7">
          {canReveal ? (
            <Button variant="secondary" className="h-12 px-3" onClick={() => setRevealed((current) => !current)} aria-label={revealed ? "Masquer" : "Afficher"}>
              {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          ) : null}
          <Button
            variant="secondary"
            className="h-12 px-3"
            disabled={!canCopy}
            onClick={async () => {
              if (!canCopy) {
                return;
              }

              try {
                await copyText(copyValue ?? value);
                setCopied(true);
              } catch {
                setCopyError(true);
              }
            }}
            aria-label="Copier"
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className={`pointer-events-none absolute right-4 top-4 rounded-full px-3 py-1 text-xs font-semibold transition ${copied ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0"} bg-[#22c55e] text-[#052e16]`}>
        Copiee
      </div>
      <div className={`pointer-events-none absolute right-4 top-4 rounded-full px-3 py-1 text-xs font-semibold transition ${copyError ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0"} bg-[#f97316] text-white`}>
        Copie impossible
      </div>
    </div>
  );
}
