import Link from "next/link";
import { Save, TicketPercent } from "lucide-react";

import { adminPromoCodes } from "@/lib/admin-data";

export default function AdminPromoCodesAddPage() {
  return (
    <div className="space-y-5">
      <section className="rounded-[18px] border border-[#e7ebf1] bg-white px-5 py-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-[28px] font-black tracking-[-0.05em] text-[#101828]">Créer un code promo</h1>
            <p className="mt-1 text-[14px] text-[#667085]">Ajoute un nouveau code relié aux campagnes marketing et aux parcours d&apos;achat existants.</p>
          </div>
          <div className="flex gap-3">
            <Link href="/admin/promo-codes" className="inline-flex h-10 items-center justify-center rounded-[12px] border border-[#e4e7ec] px-4 text-[13px] font-semibold text-[#101828] transition hover:border-[#f84557] hover:text-[#f84557]">
              Voir la liste
            </Link>
            <button type="button" className="inline-flex h-10 items-center justify-center gap-2 rounded-[12px] bg-[#f84557] px-4 text-[13px] font-semibold text-white transition hover:bg-[#ea3248]">
              <Save className="h-4 w-4" />
              Enregistrer
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-[18px] border border-[#e7ebf1] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-[13px] font-semibold text-[#344054]">
              <span>Code</span>
              <input defaultValue="WELCOME10" className="h-11 w-full rounded-[12px] border border-[#dfe3ea] px-4 text-[14px] outline-none focus:border-[#f84557]" />
            </label>
            <label className="space-y-2 text-[13px] font-semibold text-[#344054]">
              <span>Type</span>
              <select className="h-11 w-full rounded-[12px] border border-[#dfe3ea] px-4 text-[14px] outline-none focus:border-[#f84557]">
                <option>Pourcentage</option>
                <option>Montant fixe</option>
                <option>Livraison</option>
              </select>
            </label>
            <label className="space-y-2 text-[13px] font-semibold text-[#344054]">
              <span>Valeur</span>
              <input defaultValue="10%" className="h-11 w-full rounded-[12px] border border-[#dfe3ea] px-4 text-[14px] outline-none focus:border-[#f84557]" />
            </label>
            <label className="space-y-2 text-[13px] font-semibold text-[#344054]">
              <span>Achat minimum</span>
              <input defaultValue="50€" className="h-11 w-full rounded-[12px] border border-[#dfe3ea] px-4 text-[14px] outline-none focus:border-[#f84557]" />
            </label>
            <label className="space-y-2 text-[13px] font-semibold text-[#344054]">
              <span>Date de début</span>
              <input defaultValue="2026-03-22" className="h-11 w-full rounded-[12px] border border-[#dfe3ea] px-4 text-[14px] outline-none focus:border-[#f84557]" />
            </label>
            <label className="space-y-2 text-[13px] font-semibold text-[#344054]">
              <span>Date de fin</span>
              <input defaultValue="2026-12-31" className="h-11 w-full rounded-[12px] border border-[#dfe3ea] px-4 text-[14px] outline-none focus:border-[#f84557]" />
            </label>
            <label className="space-y-2 text-[13px] font-semibold text-[#344054]">
              <span>Limite d&apos;utilisation</span>
              <input defaultValue="100" className="h-11 w-full rounded-[12px] border border-[#dfe3ea] px-4 text-[14px] outline-none focus:border-[#f84557]" />
            </label>
            <label className="space-y-2 text-[13px] font-semibold text-[#344054]">
              <span>Canal</span>
              <select className="h-11 w-full rounded-[12px] border border-[#dfe3ea] px-4 text-[14px] outline-none focus:border-[#f84557]">
                <option>Mode Hero</option>
                <option>Panier</option>
                <option>Email</option>
              </select>
            </label>
          </div>
        </article>

        <aside className="space-y-4">
          <article className="rounded-[18px] border border-[#e7ebf1] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
            <div className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.14em] text-[#f84557]">
              <TicketPercent className="h-4 w-4" />
              Référence
            </div>
            <div className="mt-3 space-y-3">
              {adminPromoCodes.map((code) => (
                <div key={code.code} className="rounded-[14px] bg-[#f8fafc] px-4 py-3">
                  <div className="text-[13px] font-bold text-[#101828]">{code.code}</div>
                  <div className="mt-1 text-[12px] text-[#667085]">{code.value} • {code.channel}</div>
                </div>
              ))}
            </div>
          </article>
        </aside>
      </section>
    </div>
  );
}