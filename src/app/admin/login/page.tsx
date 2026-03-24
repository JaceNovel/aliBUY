import Link from "next/link";
import { redirect } from "next/navigation";

import { isAdminAuthenticated } from "@/lib/admin-auth";

import { AdminLoginForm } from "@/components/admin-login-form";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  if (await isAdminAuthenticated()) {
    redirect("/admin");
  }

  const resolvedSearchParams = await searchParams;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fff8f2_0%,#f5f7fb_100%)] px-4 py-6 text-[#1d2738] sm:px-6 sm:py-10 lg:px-8">
      <div className="mx-auto flex max-w-[1120px] items-center justify-center sm:min-h-[80vh]">
        <div className="grid w-full max-w-[980px] gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <section className="rounded-[24px] bg-[#111827] px-5 py-6 text-white shadow-[0_18px_42px_rgba(17,24,39,0.24)] sm:rounded-[32px] sm:px-8 sm:py-10 sm:shadow-[0_30px_80px_rgba(17,24,39,0.28)]">
            <div className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#ffb48a]">AfriPay</div>
            <h1 className="mt-3 text-[28px] font-black tracking-[-0.05em] sm:mt-4 sm:text-[46px]">Connexion securisee</h1>
            <p className="mt-3 max-w-[420px] text-[14px] leading-6 text-white/72 sm:mt-4 sm:text-[15px] sm:leading-7">
              Connecte-toi avec tes identifiants autorises pour acceder a cet espace securise AfriPay.
            </p>
            <div className="mt-6 rounded-[18px] border border-white/10 bg-white/5 px-4 py-4 text-[13px] leading-6 text-white/82 backdrop-blur sm:mt-8 sm:rounded-[24px] sm:px-5 sm:py-5 sm:text-[14px] sm:leading-7">
              <div className="font-semibold text-white">Acces protege</div>
              <div className="mt-2">Cette interface est reservee aux acces verifies et reste protegee par session sur ce navigateur.</div>
            </div>
          </section>

          <section className="rounded-[24px] border border-[#ebe4da] bg-white px-5 py-6 shadow-[0_18px_44px_rgba(17,24,39,0.08)] sm:rounded-[32px] sm:px-8 sm:py-9 sm:shadow-[0_24px_70px_rgba(17,24,39,0.08)]">
            <div className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#ff6a00]">Connexion</div>
            <h2 className="mt-2 text-[24px] font-black tracking-[-0.05em] text-[#111827] sm:mt-3 sm:text-[30px]">Acceder a votre espace</h2>
            <p className="mt-2 text-[13px] leading-6 text-[#667085] sm:mt-3 sm:text-[14px] sm:leading-7">Une fois connecte, tu resteras authentifie sur ce navigateur pendant 7 jours.</p>
            <div className="mt-5 sm:mt-6">
              <AdminLoginForm nextPath={resolvedSearchParams.next} />
            </div>
            <div className="mt-4 text-[12px] text-[#667085] sm:mt-5 sm:text-[13px]">
              <Link href="/" className="font-semibold text-[#ff6a00] transition hover:text-[#d95a00]">Retour au site</Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}