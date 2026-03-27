"use client";

import { Copy } from "lucide-react";
import { useState } from "react";

export function CopyUserIdButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          setCopied(false);
        }
      }}
      className="inline-flex items-center justify-center text-[#777] transition hover:text-[#ff6a00]"
      aria-label="Copier l'identifiant"
      title={copied ? "Copié" : "Copier l'identifiant"}
    >
      <Copy className="h-4 w-4" />
    </button>
  );
}