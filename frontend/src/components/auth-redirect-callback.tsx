"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

export function AuthRedirectCallback({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#fff8f2_0%,#f5f7fb_100%)] px-4 py-8 text-[#1d2738]">
      <div className="w-full max-w-[560px] rounded-[28px] border border-[#ebe4da] bg-white px-6 py-8 text-center shadow-[0_24px_70px_rgba(17,24,39,0.08)] sm:px-8 sm:py-10">
        <div className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#ff6a00]">Authentification</div>
        <h1 className="mt-3 text-[28px] font-black tracking-[-0.05em] text-[#111827] sm:text-[34px]">{title}</h1>
        <p className="mt-3 text-[14px] leading-7 text-[#667085] sm:text-[15px]">{description}</p>
        <div className="mt-6 inline-flex items-center gap-3 rounded-full bg-[#fff7f1] px-5 py-3 text-[14px] font-semibold text-[#ff6a00] ring-1 ring-[#f4dfd0]">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#ff6a00]" />
          Verification en cours...
        </div>
      </div>
      <AuthenticateWithRedirectCallback />
    </div>
  );
}
