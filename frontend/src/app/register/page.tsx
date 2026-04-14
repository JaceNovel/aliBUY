import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ClerkAuthPanel } from "@/components/clerk-auth-panel";
import { getSafeNextPath } from "@/lib/auth-navigation";
import { isClerkConfigured } from "@/lib/clerk-config";
import { getPricingContext } from "@/lib/pricing";
import { SITE_LOGO_PATH, SITE_NAME } from "@/lib/site-config";
import { getCurrentUser } from "@/lib/user-auth";

function getRegisterNotice(languageCode: string, reason?: string, nextPath?: string) {
  const normalizedNextPath = nextPath ?? "";
  const isEnglish = languageCode === "en";

  if (reason === "checkout_auth_required" || normalizedNextPath.startsWith("/checkout")) {
    return isEnglish
      ? "Create your account to validate your cart and return directly to payment."
      : "Créez votre compte pour valider votre panier puis revenir directement au paiement.";
  }

  if (reason === "cart_auth_required" || normalizedNextPath.startsWith("/cart")) {
    return isEnglish
      ? "Create your account to keep your cart and continue checkout without interruption."
      : "Créez votre compte pour conserver votre panier et continuer la commande sans blocage.";
  }

  return null;
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reason?: string; oauth_error?: string }>;
}) {
  const pricing = await getPricingContext();
  const currentUser = await getCurrentUser();

  const resolvedSearchParams = await searchParams;
  const nextPath = getSafeNextPath(resolvedSearchParams.next);
  const registerNotice = getRegisterNotice(pricing.languageCode, resolvedSearchParams.reason, nextPath);
  const oauthError = resolvedSearchParams.oauth_error?.trim() || "";
  const isEnglish = pricing.languageCode === "en";
  const clerkConfigured = isClerkConfigured();

  if (currentUser) {
    redirect(nextPath);
  }

  return (
    <div className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,#fff3e8_0%,#f7f9fc_34%,#e8eef6_100%)] px-4 py-6 text-[#1d2738] sm:px-6 sm:py-10">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-[1240px] items-center gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:gap-10">
        <section className="relative overflow-hidden rounded-[32px] border border-white/60 bg-[linear-gradient(140deg,rgba(255,255,255,0.88)_0%,rgba(248,250,252,0.9)_52%,rgba(255,243,232,0.94)_100%)] p-7 shadow-[0_30px_90px_rgba(31,41,55,0.10)] sm:p-9 lg:min-h-[640px] lg:p-11">
          <div className="absolute -right-14 top-8 h-40 w-40 rounded-full bg-[#ffd6b8]/55 blur-3xl" />
          <div className="absolute -left-10 bottom-4 h-44 w-44 rounded-full bg-[#d7e7ff]/60 blur-3xl" />

          <div className="relative flex h-full flex-col justify-between gap-8">
            <div>
              <Link href="/" className="inline-flex items-center gap-3 rounded-full border border-[#f2dfd1] bg-white/80 px-4 py-2 backdrop-blur">
                <Image src={SITE_LOGO_PATH} alt={`${SITE_NAME} logo`} width={34} height={34} className="h-9 w-9 object-contain" priority />
                <span className="text-[13px] font-semibold uppercase tracking-[0.18em] text-[#f97316]">{SITE_NAME}</span>
              </Link>

              <div className="mt-8 max-w-[460px]">
                <div className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[#ff6a00]">Nouveau compte</div>
                <h1 className="mt-3 text-[34px] font-black tracking-[-0.06em] text-[#111827] sm:text-[48px]">
                  Creez votre acces client sans formulaire ecrase.
                </h1>
                <p className="mt-4 max-w-[42ch] text-[15px] leading-7 text-[#5b6472] sm:text-[16px]">
                  Ouvrez votre espace AfriPay pour suivre vos commandes, vos devis et vos conversations depuis une seule interface.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[22px] border border-white/70 bg-white/75 p-4 backdrop-blur">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#98a2b3]">Compte</div>
                <div className="mt-2 text-[14px] font-semibold text-[#111827]">Creation rapide</div>
              </div>
              <div className="rounded-[22px] border border-white/70 bg-white/75 p-4 backdrop-blur">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#98a2b3]">Panier</div>
                <div className="mt-2 text-[14px] font-semibold text-[#111827]">Reprise sans perte</div>
              </div>
              <div className="rounded-[22px] border border-white/70 bg-white/75 p-4 backdrop-blur">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#98a2b3]">Support</div>
                <div className="mt-2 text-[14px] font-semibold text-[#111827]">Acces direct a l equipe</div>
              </div>
            </div>
          </div>
        </section>

        <section className="w-full">
          <div className="mx-auto max-w-[560px] rounded-[34px] border border-white/70 bg-white/90 p-6 shadow-[0_30px_90px_rgba(15,23,42,0.12)] backdrop-blur sm:p-8">
            <div className="flex items-center gap-4">
              <Image src={SITE_LOGO_PATH} alt={`${SITE_NAME} logo`} width={54} height={54} className="h-12 w-12 object-contain" priority />
              <div>
                <div className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#ff6a00]">Inscription</div>
                <div className="mt-1 text-[28px] font-black tracking-[-0.05em] text-[#111827]">Creez votre compte {SITE_NAME}</div>
              </div>
            </div>

            <p className="mt-4 text-[15px] leading-7 text-[#667085]">
              Lancez votre inscription dans un espace simple, respirant et adapte a l&apos;identite du site.
            </p>

          {registerNotice ? (
            <div className="mt-6 rounded-[22px] border border-[#ffd4b5] bg-[#fff4ea] px-4 py-4 text-[13px] leading-6 text-[#9a3412] sm:px-5 sm:text-[14px]">
              <div className="font-semibold text-[#7c2d12]">{isEnglish ? "Recommended sign up" : "Inscription recommandee"}</div>
              <div className="mt-2">{registerNotice}</div>
            </div>
          ) : null}

          {oauthError ? (
            <div className="mt-6 rounded-[22px] border border-[#f5c2c7] bg-[#fff1f2] px-4 py-4 text-[13px] leading-6 text-[#b42318] sm:px-5 sm:text-[14px]">
              <div className="font-semibold text-[#912018]">Connexion Google obsolete</div>
              <div className="mt-2">{oauthError}</div>
            </div>
          ) : null}

          {clerkConfigured ? (
            <div className="mt-6 rounded-[26px] border border-[#edf1f5] bg-[linear-gradient(180deg,#ffffff_0%,#fbfcfe_100%)] p-4 sm:p-5">
              <ClerkAuthPanel mode="sign-up" nextPath={nextPath} reason={resolvedSearchParams.reason} />
            </div>
          ) : (
            <div className="mt-6 rounded-[22px] border border-[#f5c2c7] bg-[#fff1f2] px-4 py-4 text-[13px] leading-6 text-[#b42318] sm:px-5 sm:text-[14px]">
              <div className="font-semibold text-[#912018]">Inscription indisponible</div>
              <div className="mt-2">Clerk n&apos;est pas configure sur cet environnement. Ajoutez NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY et CLERK_SECRET_KEY puis redeployez.</div>
            </div>
          )}

          </div>
        </section>
      </div>
    </div>
  );
}
