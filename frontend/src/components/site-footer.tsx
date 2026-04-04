import Link from "next/link";

import { getMessages } from "@/lib/messages";

type SiteFooterProps = {
  pricing: {
    countryLabel: string;
    currency: { code: string };
    flagEmoji: string;
    languageCode: string;
    shippingWindow?: string;
  };
};

export function SiteFooter({ pricing }: SiteFooterProps) {
  const messages = getMessages(pricing.languageCode);

  return (
    <footer className="border-t border-[#ece3d8] bg-[linear-gradient(180deg,#fffdfa_0%,#fff8f2_52%,#fff 100%)]">
      <div className="mx-auto max-w-[1680px] px-4 py-12 sm:px-6 sm:py-14 xl:px-10">
        <div className="grid gap-10 border-b border-[#efe4d8] pb-10 xl:grid-cols-[1.2fr_0.8fr_0.8fr_0.9fr]">
          <section>
            <div className="text-[30px] font-black tracking-[-0.06em] text-[#111827]">AfriPay</div>
            <p className="mt-4 max-w-[460px] text-[15px] leading-7 text-[#5f6470]">
              Une plateforme B2B pensée pour reprendre un panier, cadrer un devis, payer proprement et suivre la logistique sans zones floues.
            </p>
            <div className="mt-5 flex flex-wrap gap-3 text-[13px] font-semibold text-[#8a5a2b]">
              <span className="rounded-full border border-[#f0d9c5] bg-white px-4 py-2">Centre de reprise</span>
              <span className="rounded-full border border-[#f0d9c5] bg-white px-4 py-2">Timeline commande</span>
              <span className="rounded-full border border-[#f0d9c5] bg-white px-4 py-2">Paiement traçable</span>
            </div>
          </section>

          <section>
            <div className="text-[14px] font-semibold uppercase tracking-[0.14em] text-[#1f2937]">Catalogue</div>
            <div className="mt-4 space-y-3 text-[14px] text-[#5f6470]">
              <Link href="/products" className="block transition hover:text-[#ff6a00]">Tous les produits</Link>
              <Link href="/categories" className="block transition hover:text-[#ff6a00]">Categories</Link>
              <Link href="/trends" className="block transition hover:text-[#ff6a00]">Tendances</Link>
              <Link href="/mode" className="block transition hover:text-[#ff6a00]">Mode</Link>
              <Link href="/deals-flash" className="block transition hover:text-[#ff6a00]">Deals Flash</Link>
            </div>
          </section>

          <section>
            <div className="text-[14px] font-semibold uppercase tracking-[0.14em] text-[#1f2937]">Services</div>
            <div className="mt-4 space-y-3 text-[14px] text-[#5f6470]">
              <Link href="/quotes" className="block transition hover:text-[#ff6a00]">Demander un devis</Link>
              <Link href="/pricing" className="block transition hover:text-[#ff6a00]">Tarifs</Link>
              <Link href="/protection-commandes" className="block transition hover:text-[#ff6a00]">{messages.nav.orderProtection}</Link>
              <Link href="/support-center" className="block transition hover:text-[#ff6a00]">Centre de reprise</Link>
              <Link href="/seller-support" className="block transition hover:text-[#ff6a00]">Support vendeur</Link>
              <Link href="/pourquoi-afripay" className="block transition hover:text-[#ff6a00]">Pourquoi AfriPay</Link>
            </div>
          </section>

          <section>
            <div className="text-[14px] font-semibold uppercase tracking-[0.14em] text-[#1f2937]">Contexte AfriPay</div>
            <div className="mt-4 grid gap-3 text-[14px] text-[#5f6470]">
              <div className="flex items-center justify-between gap-3 rounded-[16px] border border-[#f1e3d5] bg-white/80 px-4 py-3">
                <span>Pays</span>
                <span className="font-semibold text-[#1f2937]">{pricing.flagEmoji} {pricing.countryLabel}</span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-[16px] border border-[#f1e3d5] bg-white/80 px-4 py-3">
                <span>Devise</span>
                <span className="font-semibold text-[#1f2937]">{pricing.currency.code}</span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-[16px] border border-[#f1e3d5] bg-white/80 px-4 py-3">
                <span>Langue</span>
                <span className="font-semibold text-[#1f2937]">{pricing.languageCode.toUpperCase()}</span>
              </div>
              {pricing.shippingWindow ? (
                <div className="rounded-[16px] border border-[#f1e3d5] bg-white/80 px-4 py-3 text-[13px] leading-6 text-[#6b7280]">
                  Fenetre logistique actuelle: <span className="font-semibold text-[#1f2937]">{pricing.shippingWindow}</span>
                </div>
              ) : null}
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-3 pt-6 text-[13px] text-[#7b7f89] sm:flex-row sm:items-center sm:justify-between">
          <div>© {new Date().getFullYear()} AfriPay. Sourcing, catalogue et operations import unifies.</div>
          <div className="flex flex-wrap gap-4">
            <Link href="/pourquoi-afripay" className="transition hover:text-[#ff6a00]">Pourquoi AfriPay</Link>
            <Link href="/support-center" className="transition hover:text-[#ff6a00]">Centre de reprise</Link>
            <Link href="/pricing" className="transition hover:text-[#ff6a00]">Tarifs</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
