import Link from "next/link";
import { redirect } from "next/navigation";

import { UserAuthForm } from "@/components/user-auth-form";
import { getCurrentUser } from "@/lib/user-auth";

function getSafeNextPath(nextPath?: string) {
  if (nextPath && nextPath.startsWith("/")) {
    return nextPath;
  }

  return "/account";
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  if (await getCurrentUser()) {
    redirect("/account");
  }

  const resolvedSearchParams = await searchParams;
  const nextPath = getSafeNextPath(resolvedSearchParams.next);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fff8f2_0%,#f5f7fb_100%)] px-4 py-10 text-[#1d2738] sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[80vh] max-w-[1120px] items-center justify-center">
        <div className="grid w-full max-w-[980px] gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <section className="rounded-[32px] bg-[#111827] px-7 py-8 text-white shadow-[0_30px_80px_rgba(17,24,39,0.28)] sm:px-8 sm:py-10">
            <div className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#ffb48a]">AfriPay Compte</div>
            <h1 className="mt-4 text-[34px] font-black tracking-[-0.05em] sm:text-[46px]">Creer votre compte</h1>
            <p className="mt-4 max-w-[420px] text-[15px] leading-7 text-white/72">
              Chaque visiteur doit maintenant s'inscrire avec sa propre adresse e-mail pour disposer d'un espace personnel distinct sur AfriPay.
            </p>
            <div className="mt-8 rounded-[24px] border border-white/10 bg-white/5 px-5 py-5 text-[14px] leading-7 text-white/82 backdrop-blur">
              <div className="font-semibold text-white">Compte individuel</div>
              <div className="mt-2">L'inscription cree un compte utilisateur reel cote serveur et ouvre une session personnelle sur ce navigateur.</div>
            </div>
          </section>

          <section className="rounded-[32px] border border-[#ebe4da] bg-white px-6 py-7 shadow-[0_24px_70px_rgba(17,24,39,0.08)] sm:px-8 sm:py-9">
            <div className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#ff6a00]">Inscription</div>
            <h2 className="mt-3 text-[30px] font-black tracking-[-0.05em] text-[#111827]">Ouvrir votre espace client</h2>
            <p className="mt-3 text-[14px] leading-7 text-[#667085]">Saisissez votre adresse e-mail, votre mot de passe puis la confirmation du mot de passe pour creer votre compte.</p>
            <div className="mt-6">
              <UserAuthForm mode="register" nextPath={nextPath} />
            </div>
            <div className="mt-5 text-[13px] text-[#667085]">
              <Link href="/" className="font-semibold text-[#ff6a00] transition hover:text-[#d95a00]">Retour au site</Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}