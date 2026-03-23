import Link from "next/link";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { getAdminOffers } from "@/lib/admin-data";
import { getPricingContext } from "@/lib/pricing";

export default async function AdminOffersPage() {
  const pricing = await getPricingContext();
  const offers = (await getAdminOffers()).slice(0, 4);

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <h1 className="text-[28px] font-black tracking-[-0.05em] text-[#12233d]">Gestion des Offres</h1>
        <Link href="/admin/offers/add" className="inline-flex h-11 items-center justify-center gap-2 rounded-[12px] bg-[#f84557] px-4 text-[14px] font-semibold text-white shadow-[0_10px_18px_rgba(248,69,87,0.18)] transition hover:bg-[#ea3248]">
          <Plus className="h-4 w-4" />
          Créer une offre groupée
        </Link>
      </section>

      <section className="rounded-[18px] border border-[#e7ebf1] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
        <h2 className="text-[18px] font-black text-[#101828]">Offres actives</h2>
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-left">
            <thead className="text-[12px] uppercase tracking-[0.08em] text-[#667085]">
              <tr>
                <th className="px-4 py-3 font-semibold">Offre</th>
                <th className="px-4 py-3 font-semibold">Fournisseur</th>
                <th className="px-4 py-3 font-semibold">Catégorie</th>
                <th className="px-4 py-3 font-semibold">MOQ</th>
                <th className="px-4 py-3 font-semibold">Prix</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {offers.map((offer) => (
                <tr key={offer.name} className="border-t border-[#edf1f6] text-[14px] text-[#101828]">
                  <td className="px-4 py-4 font-semibold">{offer.name}</td>
                  <td className="px-4 py-4">{offer.supplier}</td>
                  <td className="px-4 py-4">{offer.category}</td>
                  <td className="px-4 py-4">{offer.moq}</td>
                  <td className="px-4 py-4">{pricing.formatPrice(offer.priceMinUsd)}</td>
                  <td className="px-4 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button type="button" className="inline-flex h-10 w-10 items-center justify-center rounded-[10px] border border-[#e4e7ec] text-[#101828] transition hover:border-[#f84557] hover:text-[#f84557]">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button type="button" className="inline-flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#f84557] text-white transition hover:bg-[#ea3248]">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}