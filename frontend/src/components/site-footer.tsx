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
    <footer className="border-t border-[#e7ddd4] bg-[linear-gradient(180deg,#fff8f2_0%,#fff 38%,#fffdfb_100%)]">
      <div className="mx-auto max-w-[1680px] px-4 py-12 sm:px-6 sm:py-14 xl:px-10">
        <div className="overflow-hidden rounded-[30px] border border-[#f1dfcf] bg-[radial-gradient(circle_at_top_left,#fff0e2_0%,transparent_34%),linear-gradient(135deg,#fffdfb_0%,#fff7f0_48%,#ffffff_100%)] px-6 py-8 shadow-[0_18px_42px_rgba(17,24,39,0.06)] sm:px-8 sm:py-10">
          <div className="grid gap-10 xl:grid-cols-[1.2fr_0.8fr_0.8fr_0.9fr]">
            <section>
              <div className="text-[30px] font-black tracking-[-0.06em] text-[#111827]">AfriPay</div>
              <p className="mt-4 max-w-[460px] text-[15px] leading-7 text-[#5f6470]">
                Plateforme de sourcing B2B pour importer depuis Alibaba, publier un catalogue propre, centraliser les devis,
                suivre les commandes et vendre avec une presentation claire pour vos clients en Afrique.
              </p>
              <div className="mt-5 flex flex-wrap gap-3 text-[13px] font-semibold text-[#8a5a2b]">
                <span className="rounded-full bg-white/90 px-4 py-2 ring-1 ring-[#f2d9c5]">Import Alibaba structure</span>
                <span className="rounded-full bg-white/90 px-4 py-2 ring-1 ring-[#f2d9c5]">Catalogue AfriPay</span>
                <span className="rounded-full bg-white/90 px-4 py-2 ring-1 ring-[#f2d9c5]">Paiements et logistique</span>
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
                <Link href="/support-center" className="block transition hover:text-[#ff6a00]">Centre d&apos;assistance</Link>
                <Link href="/seller-support" className="block transition hover:text-[#ff6a00]">Support vendeur</Link>
              </div>
            </section>

            <section>
              <div className="text-[14px] font-semibold uppercase tracking-[0.14em] text-[#1f2937]">Contexte AfriPay</div>
              <div className="mt-4 space-y-3 rounded-[22px] bg-white/85 px-5 py-5 text-[14px] text-[#5f6470] ring-1 ring-[#f1e3d5]">
                <div className="flex items-center justify-between gap-3">
                  <span>Pays</span>
                  <span className="font-semibold text-[#1f2937]">{pricing.flagEmoji} {pricing.countryLabel}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Devise</span>
                  <span className="font-semibold text-[#1f2937]">{pricing.currency.code}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Langue</span>
                  <span className="font-semibold text-[#1f2937]">{pricing.languageCode.toUpperCase()}</span>
                </div>
                {pricing.shippingWindow ? (
                  <div className="border-t border-[#f1e6dc] pt-3 text-[13px] leading-6 text-[#6b7280]">
                    Fenetre logistique actuelle: <span className="font-semibold text-[#1f2937]">{pricing.shippingWindow}</span>
                  </div>
                ) : null}
              </div>
            </section>
          </div>

          <div className="mt-8 flex flex-col gap-3 border-t border-[#f0e2d5] pt-6 text-[13px] text-[#7b7f89] sm:flex-row sm:items-center sm:justify-between">
            <div>© {new Date().getFullYear()} AfriPay. Sourcing, catalogue et operations import unifies.</div>
            <div className="flex flex-wrap gap-4">
              <Link href="/decouvrir-afripay" className="transition hover:text-[#ff6a00]">Decouvrir AfriPay</Link>
              <Link href="/support-center" className="transition hover:text-[#ff6a00]">Assistance</Link>
              <Link href="/pricing" className="transition hover:text-[#ff6a00]">Tarifs</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
