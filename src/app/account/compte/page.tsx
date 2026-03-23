import Link from "next/link";
import { ChevronRight, Mail, ShieldCheck, Trash2 } from "lucide-react";

import { accountCards } from "@/app/account/compte/account-links";
import { InternalPageShell } from "@/components/internal-page-shell";
import { getPricingContext } from "@/lib/pricing";

export default async function AccountSettingsPage() {
  const pricing = await getPricingContext();

  return (
    <InternalPageShell pricing={pricing}>
      <div className="space-y-5 sm:space-y-8">
        <div className="flex flex-wrap items-center gap-2 text-[12px] text-[#7b675a] sm:text-[13px]">
          <Link href="/account" className="transition hover:text-[#ff6a00]">Profil</Link>
          <span>/</span>
          <span className="font-semibold text-[#221f1c]">Compte</span>
        </div>

        <section className="overflow-hidden rounded-[28px] bg-white shadow-[0_10px_30px_rgba(24,39,75,0.05)] ring-1 ring-black/5 sm:rounded-[32px]">
          <div className="border-b border-[#ececec] px-5 py-5 sm:px-8 sm:py-7">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#fff2e9] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#d85300] sm:px-4 sm:py-2 sm:text-[13px] sm:tracking-[0.16em]">
              <ShieldCheck className="h-4 w-4" />
              Paramètres du compte
            </div>
            <h1 className="mt-3 text-[26px] font-bold tracking-[-0.05em] text-[#222] sm:mt-4 sm:text-[42px]">Gérer votre compte</h1>
            <p className="mt-2 max-w-[760px] text-[14px] leading-6 text-[#666] sm:text-[16px] sm:leading-8">
              Retrouvez ici vos informations personnelles, vos réglages de sécurité et vos préférences AfriPay.
            </p>
          </div>

          <div className="grid gap-4 px-4 py-4 sm:px-8 sm:py-8 xl:grid-cols-2">
            {accountCards.map((card) => {
              const Icon = card.icon;

              return (
                <article key={card.title} className="rounded-[24px] bg-[#fafafa] px-4 py-4 ring-1 ring-black/5 sm:px-6 sm:py-6">
                  <div className="flex items-center gap-3 border-b border-[#e9e9e9] pb-4 text-[17px] font-semibold text-[#222] sm:text-[20px]">
                    <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-white text-[#ff6a00] ring-1 ring-black/5">
                      <Icon className="h-5 w-5" />
                    </div>
                    {card.title}
                  </div>

                  <div className="space-y-1 pt-3 sm:pt-4">
                    {card.items.map((item) => (
                      <Link
                        key={item.slug}
                        href={`/account/compte/${item.slug}`}
                        className="flex w-full items-center justify-between rounded-[16px] px-1 py-3 text-left text-[15px] text-[#222] transition hover:bg-white sm:px-2 sm:text-[17px]"
                      >
                        <span>{item.label}</span>
                        <ChevronRight className="h-4 w-4 text-[#9b9b9b]" />
                      </Link>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>

          <div className="border-t border-[#ececec] px-5 py-5 sm:px-8 sm:py-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3 text-[#222]">
                <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[#fff2ea] text-[#ff6a00]">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[15px] font-semibold sm:text-[17px]">Adresse e-mail actuelle</div>
                  <div className="text-[13px] text-[#666] sm:text-[15px]">jac***@gmail.com</div>
                </div>
              </div>
              <Link href="/account/compte/changer-adresse-email" className="inline-flex h-11 items-center justify-center rounded-full border border-[#222] px-5 text-[14px] font-semibold text-[#222] transition hover:border-[#ff6a00] hover:text-[#ff6a00] sm:h-12 sm:px-6 sm:text-[15px]">
                Mettre à jour
              </Link>
            </div>

            <Link href="/account/compte/supprimer-compte" className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[#f0cfcf] bg-[#fff8f8] px-5 text-[14px] font-semibold text-[#c74444] transition hover:bg-[#fff1f1] sm:h-12 sm:text-[15px]">
              <Trash2 className="h-4 w-4" />
              Supprimer le compte
            </Link>
          </div>
        </section>
      </div>
    </InternalPageShell>
  );
}