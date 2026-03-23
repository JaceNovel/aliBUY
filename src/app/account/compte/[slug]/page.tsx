import Link from "next/link";
import { ArrowLeft, ChevronRight, ShieldCheck } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { accountPageMeta, type AccountPageSlug } from "@/app/account/compte/account-links";
import { InternalPageShell } from "@/components/internal-page-shell";
import { getCurrentUser } from "@/lib/user-auth";
import { getPricingContext } from "@/lib/pricing";

export async function generateStaticParams() {
  return Object.keys(accountPageMeta).map((slug) => ({ slug }));
}

export default async function AccountSettingDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const pricing = await getPricingContext();
  const user = await getCurrentUser();
  const { slug } = await params;
  const page = accountPageMeta[slug as AccountPageSlug];

  if (!user) {
    redirect(`/login?next=/account/compte/${slug}`);
  }

  if (!page) {
    notFound();
  }

  return (
    <InternalPageShell pricing={pricing}>
      <div className="space-y-5 sm:space-y-8">
        <div className="flex flex-wrap items-center gap-2 text-[12px] text-[#7b675a] sm:text-[13px]">
          <Link href="/account" className="transition hover:text-[#ff6a00]">Profil</Link>
          <span>/</span>
          <Link href="/account/compte" className="transition hover:text-[#ff6a00]">Compte</Link>
          <span>/</span>
          <span className="font-semibold text-[#221f1c]">{page.title}</span>
        </div>

        <section className="overflow-hidden rounded-[28px] bg-white shadow-[0_10px_30px_rgba(24,39,75,0.05)] ring-1 ring-black/5 sm:rounded-[32px]">
          <div className="border-b border-[#ececec] px-5 py-5 sm:px-8 sm:py-7">
            <div className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white sm:px-4 sm:py-2 sm:text-[13px] sm:tracking-[0.16em]" style={{ backgroundColor: page.accent }}>
              <ShieldCheck className="h-4 w-4" />
              Paramètre dédié
            </div>
            <h1 className="mt-3 text-[26px] font-bold tracking-[-0.05em] text-[#222] sm:mt-4 sm:text-[42px]">{page.title}</h1>
            <p className="mt-2 max-w-[760px] text-[14px] leading-6 text-[#666] sm:text-[16px] sm:leading-8">{page.description}</p>
          </div>

          <div className="grid gap-5 px-4 py-4 sm:px-8 sm:py-8 xl:grid-cols-[0.9fr_1.1fr]">
            <article className="rounded-[24px] bg-[#fafafa] px-4 py-4 ring-1 ring-black/5 sm:px-6 sm:py-6">
              <div className="text-[17px] font-semibold text-[#222] sm:text-[20px]">Actions rapides</div>
              <div className="mt-4 space-y-3">
                {page.bullets.map((item) => (
                  <div key={item} className="flex items-center justify-between rounded-[16px] bg-white px-4 py-3 text-[14px] text-[#222] ring-1 ring-black/5 sm:text-[15px]">
                    <span>{item}</span>
                    <ChevronRight className="h-4 w-4 text-[#9b9b9b]" />
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-[24px] bg-[#fafafa] px-4 py-4 ring-1 ring-black/5 sm:px-6 sm:py-6">
              <div className="text-[17px] font-semibold text-[#222] sm:text-[20px]">Centre de gestion</div>
              <div className="mt-4 rounded-[18px] bg-white px-4 py-4 ring-1 ring-black/5">
                <div className="text-[14px] leading-6 text-[#555] sm:text-[15px] sm:leading-7">
                  Cette page dédiée centralise les réglages liés à <span className="font-semibold text-[#222]">{page.title}</span>. Vous pouvez ensuite brancher les formulaires réels ou la logique métier finale sans changer la navigation.
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <button type="button" className="inline-flex h-11 items-center justify-center rounded-full px-5 text-[14px] font-semibold text-white transition sm:h-12 sm:px-6 sm:text-[15px]" style={{ backgroundColor: page.accent }}>
                  Enregistrer
                </button>
                <Link href="/account/compte" className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[#222] px-5 text-[14px] font-semibold text-[#222] transition hover:border-[#ff6a00] hover:text-[#ff6a00] sm:h-12 sm:px-6 sm:text-[15px]">
                  <ArrowLeft className="h-4 w-4" />
                  Retour à Compte
                </Link>
              </div>
            </article>
          </div>
        </section>
      </div>
    </InternalPageShell>
  );
}