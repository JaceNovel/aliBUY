import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { UserLoginForm } from "@/components/user-login-form";
import { isAdminEmail } from "@/lib/admin-auth";
import { getSafeNextPath } from "@/lib/google-oauth";
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
  const isEnglish = pricing.languageCode === "en";
  const hasGoogleOauth = Boolean(process.env.GOOGLE_CLIENT_ID?.trim()) && Boolean(process.env.GOOGLE_CLIENT_SECRET?.trim());

  if (currentUser) {
    redirect(isAdminEmail(currentUser.email) && nextPath.startsWith("/admin") ? nextPath : isAdminEmail(currentUser.email) ? "/home_jacen" : "/account");
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#f8fafc_0%,#eef2f7_36%,#e8edf4_100%)] px-4 py-6 text-[#1d2738] sm:px-6 sm:py-10">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-[1180px] items-center justify-center">
        <section className="w-full max-w-[560px] px-2 py-4 sm:px-0 sm:py-0">
          <div className="flex justify-center">
            <Link href="/" className="inline-flex items-center justify-center text-center">
              <Image src={SITE_LOGO_PATH} alt={`${SITE_NAME} logo`} width={82} height={82} className="h-20 w-20 object-contain" priority />
            </Link>
          </div>

          {authNotice ? (
            <div className="mt-6 rounded-[20px] border border-[#ffd4b5] bg-[#fff4ea] px-4 py-4 text-[13px] leading-6 text-[#9a3412] sm:px-5 sm:text-[14px]">
              <div className="font-semibold text-[#7c2d12]">{authNotice.title}</div>
              <div className="mt-2">{authNotice.description}</div>
            </div>
          ) : null}

          {oauthError ? (
            <div className="mt-6 rounded-[20px] border border-[#f5c2c7] bg-[#fff1f2] px-4 py-4 text-[13px] leading-6 text-[#b42318] sm:px-5 sm:text-[14px]">
              <div className="font-semibold text-[#912018]">Connexion Google indisponible</div>
              <div className="mt-2">{oauthError}</div>
            </div>
          ) : null}

          <div className="mt-6">
            <UserLoginForm
              nextPath={nextPath}
              registerHref={`/register?next=${encodeURIComponent(nextPath)}${resolvedSearchParams.reason ? `&reason=${encodeURIComponent(resolvedSearchParams.reason)}` : ""}`}
              googleAuthHref={hasGoogleOauth ? `/api/auth/google/start?mode=login&next=${encodeURIComponent(nextPath)}` : null}
              submitLabel={isEnglish ? "Sign in" : "Se connecter"}
              emailLabel={isEnglish ? "Email address" : "Adresse e-mail"}
              passwordLabel={isEnglish ? "Password" : "Mot de passe"}
            />
          </div>

        </section>
      </div>
    </div>
  );
}
