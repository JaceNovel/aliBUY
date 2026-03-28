import Link from "next/link";

import { InternalPageShell } from "@/components/internal-page-shell";
import { getPricingContext } from "@/lib/pricing";

export default async function SellerSupportPage() {
  const pricing = await getPricingContext();

  return (
    <InternalPageShell pricing={pricing}>
      <section className="rounded-[30px] bg-white px-6 py-8 shadow-[0_16px_40px_rgba(17,24,39,0.05)] ring-1 ring-black/5 sm:px-8 sm:py-10">
        <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#ff6a00]">Support vendeur</div>
        <h1 className="mt-3 text-[32px] font-black tracking-[-0.05em] text-[#1f2937]">Accompagnement vendeur et demande produit</h1>
        <p className="mt-3 max-w-[760px] text-[15px] leading-7 text-[#667085]">Les demandes vendeurs passent maintenant par le devis commercial, le suivi AfriPay et les echanges directs avec notre equipe.</p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Link href="/quotes" className="rounded-[20px] border border-[#e6eaf0] bg-[#fafafa] px-5 py-5 transition hover:border-[#ff6a00] hover:bg-white">
            <div className="text-[18px] font-bold text-[#1f2937]">Demander un devis</div>
            <div className="mt-2 text-[14px] leading-6 text-[#667085]">Envoyez votre besoin produit pour ouvrir un accompagnement commercial et sourcing.</div>
          </Link>
          <Link href="/support-center" className="rounded-[20px] border border-[#e6eaf0] bg-[#fafafa] px-5 py-5 transition hover:border-[#ff6a00] hover:bg-white">
            <div className="text-[18px] font-bold text-[#1f2937]">Centre d&apos;assistance</div>
            <div className="mt-2 text-[14px] leading-6 text-[#667085]">Consultez les informations utiles puis contactez l&apos;equipe AfriPay si besoin.</div>
          </Link>
        </div>
      </section>
    </InternalPageShell>
  );
}
