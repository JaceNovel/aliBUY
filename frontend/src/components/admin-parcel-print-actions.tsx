"use client";

import Link from "next/link";
import { useState } from "react";

export function AdminParcelPrintActions({ orderHref, pdfHref, documentNumber }: { orderHref: string; pdfHref: string; documentNumber: string }) {
  const printHref = `${pdfHref}?disposition=inline`;
  const downloadHref = `${pdfHref}?disposition=attachment`;
  const [copyLabel, setCopyLabel] = useState("Copier le numero");

  const copyDocumentNumber = async () => {
    try {
      await navigator.clipboard.writeText(documentNumber);
      setCopyLabel("Numero copie");
      window.setTimeout(() => setCopyLabel("Copier le numero"), 1800);
    } catch {
      setCopyLabel("Copie impossible");
      window.setTimeout(() => setCopyLabel("Copier le numero"), 1800);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <button type="button" onClick={() => void copyDocumentNumber()} className="inline-flex h-10 items-center justify-center rounded-[14px] border border-[#d7dce5] bg-white px-4 text-[13px] font-semibold text-[#1f2937] transition hover:border-[#ff6a5b] hover:text-[#ff6a5b]">
        {copyLabel}
      </button>
      <Link href={downloadHref} target="_blank" className="inline-flex h-10 items-center justify-center rounded-[14px] bg-[#ff6a00] px-4 text-[13px] font-semibold text-white transition hover:bg-[#eb6200]">
        Telecharger le PDF
      </Link>
      <Link href={printHref} target="_blank" className="inline-flex h-10 items-center justify-center rounded-[14px] bg-[#111827] px-4 text-[13px] font-semibold text-white transition hover:bg-[#1f2937]">
        Imprimer le bon
      </Link>
      <Link href={orderHref} className="inline-flex h-10 items-center justify-center rounded-[14px] border border-[#d7dce5] px-4 text-[13px] font-semibold text-[#1f2937] transition hover:border-[#ff6a5b] hover:text-[#ff6a5b]">
        Retour commande
      </Link>
    </div>
  );
}