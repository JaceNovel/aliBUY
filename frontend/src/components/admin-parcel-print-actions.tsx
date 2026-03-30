"use client";

import Link from "next/link";

export function AdminParcelPrintActions({ orderHref }: { orderHref: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <button type="button" onClick={() => window.print()} className="inline-flex h-10 items-center justify-center rounded-[14px] bg-[#111827] px-4 text-[13px] font-semibold text-white transition hover:bg-[#1f2937]">
        Imprimer le bon
      </button>
      <Link href={orderHref} className="inline-flex h-10 items-center justify-center rounded-[14px] border border-[#d7dce5] px-4 text-[13px] font-semibold text-[#1f2937] transition hover:border-[#ff6a5b] hover:text-[#ff6a5b]">
        Retour commande
      </Link>
    </div>
  );
}