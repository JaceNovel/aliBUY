import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ClerkAuthPanel } from "@/components/clerk-auth-panel";
import { isClerkConfigured } from "@/lib/clerk-config";
import { getSafeNextPath } from "@/lib/auth-navigation";
import { getPricingContext } from "@/lib/pricing";
import { SITE_LOGO_PATH, SITE_NAME } from "@/lib/site-config";
import { getCurrentUser } from "@/lib/user-auth";

function getAuthNotice(languageCode: string, reason?: string, nextPath?: string) {
  const normalizedNextPath = nextPath ?? "";
  const isEnglish = languageCode === "en";

  if (reason === "checkout_auth_required" || normalizedNextPath.startsWith("/checkout")) {
    return {
      title: isEnglish ? "Sign up or sign in required" : "Inscription ou connexion requise",
      description: isEnglish
        ? "To complete your cart, please sign up with the Sign up button or sign in if you already have an account."
        : "Pour finaliser votre panier, veuillez vous inscrire avec le bouton Inscription ou vous connecter si vous avez deja un compte.",
    };
  }

  if (reason === "cart_auth_required" || normalizedNextPath.startsWith("/cart")) {
    return {
      title: isEnglish ? "Please sign up before continuing" : "Veuillez vous inscrire avant de continuer",
      description: isEnglish
        ? "Your cart is ready, but you need to sign up with the Sign up button or sign in before continuing."
        : "Vous avez bien des articles dans votre panier, mais vous devez d'abord vous inscrire avec le bouton Inscription ou vous connecter pour continuer.",
    };
  }

  return null;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reason?: string; oauth_error?: string }>;
}) {
  const pricing = await getPricingContext();
  const currentUser = await getCurrentUser();

  const resolvedSearchParams = await searchParams;
  const nextPath = getSafeNextPath(resolvedSearchParams.next);
  const authNotice = getAuthNotice(pricing.languageCode, resolvedSearchParams.reason, nextPath);
  const oauthError = resolvedSearchParams.oauth_error?.trim() || "";
  const clerkConfigured = isClerkConfigured();

  if (currentUser) {
    redirect(nextPath);
  }

  return (
    <div className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,#fff3e8_0%,#f7f9fc_34%,#e8eef6_100%)] px-3 py-3 text-[#1d2738] sm:px-6 sm:py-8 lg:py-10">
      <div className="mx-auto grid max-w-[1240px] items-start gap-4 lg:min-h-[calc(100vh-3rem)] lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-10">
        <section className="order-2 relative overflow-hidden rounded-[24px] border border-white/60 bg-[linear-gradient(140deg,rgba(255,255,255,0.88)_0%,rgba(248,250,252,0.9)_52%,rgba(255,243,232,0.94)_100%)] p-5 shadow-[0_24px_70px_rgba(31,41,55,0.08)] sm:rounded-[32px] sm:p-8 lg:order-1 lg:min-h-[640px] lg:p-11">
          <div className="absolute -right-14 top-8 h-40 w-40 rounded-full bg-[#ffd6b8]/55 blur-3xl" />
          <div className="absolute -left-10 bottom-4 h-44 w-44 rounded-full bg-[#d7e7ff]/60 blur-3xl" />

          <div className="relative flex h-full flex-col justify-between gap-5 sm:gap-8">
            <div>
              <Link href="/" className="inline-flex items-center gap-3 rounded-full border border-[#f2dfd1] bg-white/80 px-3 py-2 backdrop-blur sm:px-4">
                <Image src={SITE_LOGO_PATH} alt={`${SITE_NAME} logo`} width={34} height={34} className="h-8 w-8 object-contain sm:h-9 sm:w-9" priority />
                <span className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#f97316] sm:text-[13px] sm:tracking-[0.18em]">{SITE_NAME}</span>
              </Link>

              <div className="mt-6 max-w-[460px] sm:mt-8">
                <div className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[#ff6a00]">Acces client</div>
                <h1 className="mt-3 text-[28px] font-black tracking-[-0.06em] text-[#111827] sm:text-[40px] lg:text-[48px]">
                  Connectez-vous avec une interface nette et lisible.
                </h1>
                <p className="mt-3 max-w-[42ch] text-[14px] leading-6 text-[#5b6472] sm:mt-4 sm:text-[16px] sm:leading-7">
                  Retrouvez vos commandes, devis, messages et favoris dans un espace clair, sans habillage encombrant.
                </p>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-3 sm:gap-3">
              <div className="rounded-[18px] border border-white/70 bg-white/75 p-3 backdrop-blur sm:rounded-[22px] sm:p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#98a2b3]">Commandes</div>
                <div className="mt-1.5 text-[13px] font-semibold text-[#111827] sm:mt-2 sm:text-[14px]">Suivi centralise</div>
              </div>
              <div className="rounded-[18px] border border-white/70 bg-white/75 p-3 backdrop-blur sm:rounded-[22px] sm:p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#98a2b3]">Messages</div>
                <div className="mt-1.5 text-[13px] font-semibold text-[#111827] sm:mt-2 sm:text-[14px]">Conversation client simple</div>
              </div>
              <div className="rounded-[18px] border border-white/70 bg-white/75 p-3 backdrop-blur sm:rounded-[22px] sm:p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#98a2b3]">Paiements</div>
                <div className="mt-1.5 text-[13px] font-semibold text-[#111827] sm:mt-2 sm:text-[14px]">Acces rapide a vos validations</div>
              </div>
            </div>
          </div>
        </section>

        <section className="order-1 w-full lg:order-2">
          <div className="mx-auto max-w-[560px] rounded-[24px] border border-white/70 bg-white/90 p-4 shadow-[0_24px_70px_rgba(15,23,42,0.10)] backdrop-blur sm:rounded-[34px] sm:p-8">
            <div className="flex items-center gap-3 sm:gap-4">
              <Image src={SITE_LOGO_PATH} alt={`${SITE_NAME} logo`} width={54} height={54} className="h-10 w-10 object-contain sm:h-12 sm:w-12" priority />
              <div>
                <div className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#ff6a00]">Connexion</div>
                <div className="mt-1 text-[22px] font-black tracking-[-0.05em] text-[#111827] sm:text-[28px]">Bienvenue sur {SITE_NAME}</div>
              </div>
            </div>

            <p className="mt-3 text-[14px] leading-6 text-[#667085] sm:mt-4 sm:text-[15px] sm:leading-7">
              Utilisez votre adresse e-mail et votre mot de passe pour ouvrir votre espace client.
            </p>

          {authNotice ? (
            <div className="mt-4 rounded-[18px] border border-[#ffd4b5] bg-[#fff4ea] px-4 py-3 text-[13px] leading-6 text-[#9a3412] sm:mt-6 sm:rounded-[22px] sm:px-5 sm:py-4 sm:text-[14px]">
              <div className="font-semibold text-[#7c2d12]">{authNotice.title}</div>
              <div className="mt-2">{authNotice.description}</div>
            </div>
          ) : null}

          {oauthError ? (
            <div className="mt-4 rounded-[18px] border border-[#f5c2c7] bg-[#fff1f2] px-4 py-3 text-[13px] leading-6 text-[#b42318] sm:mt-6 sm:rounded-[22px] sm:px-5 sm:py-4 sm:text-[14px]">
              <div className="font-semibold text-[#912018]">Connexion Google obsolete</div>
              <div className="mt-2">{oauthError}</div>
            </div>
          ) : null}

          {clerkConfigured ? (
            <div className="mt-4 rounded-[20px] border border-[#edf1f5] bg-[linear-gradient(180deg,#ffffff_0%,#fbfcfe_100%)] p-2.5 sm:mt-6 sm:rounded-[26px] sm:p-5">
              <ClerkAuthPanel mode="sign-in" nextPath={nextPath} reason={resolvedSearchParams.reason} />
            </div>
          ) : (
            <div className="mt-4 rounded-[18px] border border-[#f5c2c7] bg-[#fff1f2] px-4 py-3 text-[13px] leading-6 text-[#b42318] sm:mt-6 sm:rounded-[22px] sm:px-5 sm:py-4 sm:text-[14px]">
              <div className="font-semibold text-[#912018]">Connexion indisponible</div>
              <div className="mt-2">Clerk n&apos;est pas configure sur cet environnement. Ajoutez NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY et CLERK_SECRET_KEY puis redeployez.</div>
            </div>
          )}

          </div>
        </section>
      </div>
    </div>
  );
}
