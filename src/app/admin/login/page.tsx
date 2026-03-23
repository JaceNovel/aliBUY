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
    <div className="min-h-screen bg-[linear-gradient(180deg,#fff8f2_0%,#f5f7fb_100%)] px-4 py-10 text-[#1d2738] sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[80vh] max-w-[1120px] items-center justify-center">
        <div className="grid w-full max-w-[980px] gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <section className="rounded-[32px] bg-[#111827] px-7 py-8 text-white shadow-[0_30px_80px_rgba(17,24,39,0.28)] sm:px-8 sm:py-10">
            <div className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#ffb48a]">AfriPay Admin</div>
            <h1 className="mt-4 text-[34px] font-black tracking-[-0.05em] sm:text-[46px]">Connexion securisee au back-office</h1>
            <p className="mt-4 max-w-[420px] text-[15px] leading-7 text-white/72">
              Connecte-toi avec l&apos;email admin exact et le mot de passe configure pour acceder au cockpit AfriPay.
            </p>
            <div className="mt-8 rounded-[24px] border border-white/10 bg-white/5 px-5 py-5 text-[14px] leading-7 text-white/82 backdrop-blur">
              <div className="font-semibold text-white">Acces restreint</div>
              <div className="mt-2">Toutes les routes sous <span className="font-semibold text-white">/admin</span> et les APIs admin sont protegees par session.</div>
            </div>
          </section>

          <section className="rounded-[32px] border border-[#ebe4da] bg-white px-6 py-7 shadow-[0_24px_70px_rgba(17,24,39,0.08)] sm:px-8 sm:py-9">
            <div className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#ff6a00]">Connexion</div>
            <h2 className="mt-3 text-[30px] font-black tracking-[-0.05em] text-[#111827]">Acceder a l&apos;administration</h2>
            <p className="mt-3 text-[14px] leading-7 text-[#667085]">Une fois connecte, tu resteras authentifie sur ce navigateur pendant 7 jours.</p>
            <div className="mt-6">
              <AdminLoginForm nextPath={resolvedSearchParams.next} />
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