import Link from "next/link";

import { InternalPageShell } from "@/components/internal-page-shell";
import { getPricingContext } from "@/lib/pricing";

export default async function ApplicationPage() {
  const pricing = await getPricingContext();

  return (
    <InternalPageShell pricing={pricing}>
      <section className="rounded-[30px] bg-white px-6 py-8 shadow-[0_16px_40px_rgba(17,24,39,0.05)] ring-1 ring-black/5 sm:px-8 sm:py-10">
        <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#ff6a00]">Application</div>
        <h1 className="mt-3 text-[32px] font-black tracking-[-0.05em] text-[#1f2937]">Application et accès rapides</h1>
        <p className="mt-3 max-w-[760px] text-[15px] leading-7 text-[#667085]">Cette page centralise les accès fonctionnels du projet: compte, recherche produit, sourcing et paiement.</p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Link href="/products" className="rounded-[20px] border border-[#e6eaf0] bg-[#fafafa] px-5 py-5 transition hover:border-[#ff6a00] hover:bg-white">
            <div className="text-[18px] font-bold text-[#1f2937]">Catalogue produit</div>
            <div className="mt-2 text-[14px] leading-6 text-[#667085]">Accéder aux produits publiés et aux catégories réelles.</div>
          </Link>
          <Link href="/cart" className="rounded-[20px] border border-[#e6eaf0] bg-[#fafafa] px-5 py-5 transition hover:border-[#ff6a00] hover:bg-white">
            <div className="text-[18px] font-bold text-[#1f2937]">Panier et sourcing</div>
            <div className="mt-2 text-[14px] leading-6 text-[#667085]">Lancer un checkout sourcing et calculer le fret réel.</div>
          </Link>
        </div>
      </section>
    </InternalPageShell>
  );
}