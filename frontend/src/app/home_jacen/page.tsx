import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminLoginForm } from "@/components/admin-login-form";
import { isAdminAuthenticated } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "Acces prive",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function HiddenAdminLoginPage() {
  if (await isAdminAuthenticated()) {
    redirect("/admin");
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#fff2e5_0%,#fff9f4_28%,#f6f8fc_100%)] px-4 py-8 text-[#1d2738] sm:px-6 sm:py-12">
      <div className="mx-auto flex max-w-[520px] items-center justify-center sm:min-h-[78vh]">
        <section className="w-full rounded-[30px] border border-[#f0dfd2] bg-white px-5 py-6 shadow-[0_26px_80px_rgba(17,24,39,0.12)] sm:px-8 sm:py-9">
          <div className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[#ff6a00]">Zone privee</div>
          <h1 className="mt-3 text-[30px] font-black tracking-[-0.06em] text-[#111827] sm:text-[38px]">Connexion securisee</h1>
          <p className="mt-3 text-[14px] leading-7 text-[#667085]">
            Saisissez votre adresse e-mail et votre mot de passe pour ouvrir l&apos;administration.
          </p>

          <div className="mt-6">
            <AdminLoginForm nextPath="/admin" />
          </div>
        </section>
      </div>
    </div>
  );
}