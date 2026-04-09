import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { UserRegisterForm } from "@/components/user-register-form";
import { isAdminEmail } from "@/lib/admin-auth";
import { getPricingContext } from "@/lib/pricing";
import { SITE_LOGO_PATH, SITE_NAME } from "@/lib/site-config";
import { getCurrentUser } from "@/lib/user-auth";

function getSafeNextPath(nextPath?: string) {
  if (nextPath && nextPath.startsWith("/")) {
    return nextPath;
  }

  return "/account";
}

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
  searchParams: Promise<{ next?: string; reason?: string }>;
}) {
  const pricing = await getPricingContext();
  const currentUser = await getCurrentUser();

  const resolvedSearchParams = await searchParams;
  const nextPath = getSafeNextPath(resolvedSearchParams.next);
  const registerNotice = getRegisterNotice(pricing.languageCode, resolvedSearchParams.reason, nextPath);
  const isEnglish = pricing.languageCode === "en";

  if (currentUser) {
    redirect(isAdminEmail(currentUser.email) && nextPath.startsWith("/admin") ? nextPath : isAdminEmail(currentUser.email) ? "/home_jacen" : "/account");
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#f8fafc_0%,#eef2f7_36%,#e8edf4_100%)] px-4 py-6 text-[#1d2738] sm:px-6 sm:py-10">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-[1180px] items-center justify-center">
        <section className="w-full max-w-[560px] px-2 py-4 sm:px-0 sm:py-0">
          <div className="flex justify-center">
            <Link href="/" className="inline-flex flex-col items-center text-center">
              <Image src={SITE_LOGO_PATH} alt={`${SITE_NAME} logo`} width={82} height={82} className="h-20 w-20 object-contain" priority />
              <span className="mt-3 text-[34px] font-black tracking-[-0.06em] text-[#111827]">{SITE_NAME}</span>
            </Link>
          </div>

          {registerNotice ? (
            <div className="mt-6 rounded-[20px] border border-[#ffd4b5] bg-[#fff4ea] px-4 py-4 text-[13px] leading-6 text-[#9a3412] sm:px-5 sm:text-[14px]">
              <div className="font-semibold text-[#7c2d12]">{isEnglish ? "Recommended sign up" : "Inscription recommandee"}</div>
              <div className="mt-2">{registerNotice}</div>
            </div>
          ) : null}

          <div className="mt-6">
            <UserRegisterForm
              nextPath={nextPath}
              loginHref={`/login?next=${encodeURIComponent(nextPath)}${resolvedSearchParams.reason ? `&reason=${encodeURIComponent(resolvedSearchParams.reason)}` : ""}`}
              submitLabel={isEnglish ? "Create account" : "Creer un compte"}
            />
          </div>

        </section>
      </div>
    </div>
  );
}
