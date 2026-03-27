import Link from "next/link";

import { InternalPageShell } from "@/components/internal-page-shell";
import { getPricingContext } from "@/lib/pricing";

export default async function SupportCenterPage() {
  const pricing = await getPricingContext();

  return (
    <InternalPageShell pricing={pricing}>
      <section className="rounded-[30px] bg-white px-6 py-8 shadow-[0_16px_40px_rgba(17,24,39,0.05)] ring-1 ring-black/5 sm:px-8 sm:py-10">
        <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#ff6a00]">Support</div>
        <h1 className="mt-3 text-[32px] font-black tracking-[-0.05em] text-[#1f2937]">Centre d&apos;assistance</h1>
        <p className="mt-3 max-w-[760px] text-[15px] leading-7 text-[#667085]">Retrouvez ici les accès utiles pour vos commandes, vos messages support et vos demandes de devis.</p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            { title: "Messages", href: "/messages", description: "Suivi des échanges avec le support AfriPay." },
            { title: "Commandes", href: "/orders", description: "Historique, paiement et suivi logistique." },
            { title: "Demandes de devis", href: "/quotes", description: "Vos besoins d'importation et de sourcing." },
          ].map((item) => (
            <Link key={item.href} href={item.href} className="rounded-[20px] border border-[#e6eaf0] bg-[#fafafa] px-5 py-5 transition hover:border-[#ff6a00] hover:bg-white">
              <div className="text-[18px] font-bold text-[#1f2937]">{item.title}</div>
              <div className="mt-2 text-[14px] leading-6 text-[#667085]">{item.description}</div>
            </Link>
          ))}
        </div>
      </section>
    </InternalPageShell>
  );
}