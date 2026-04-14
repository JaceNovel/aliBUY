"use client";

import Link from "next/link";
import { AuthenticateWithRedirectCallback, useAuth } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

export function AuthRedirectCallback({
  title,
  description,
  defaultRedirectPath = "/account",
}: {
  title: string;
  description: string;
  defaultRedirectPath?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoaded, isSignedIn } = useAuth();
  const [showManualActions, setShowManualActions] = useState(false);
  const resolvedRedirectPath = useMemo(() => {
    const redirectCandidates = [
      searchParams.get("redirect_url"),
      searchParams.get("force_redirect_url"),
      searchParams.get("sign_in_force_redirect_url"),
      searchParams.get("sign_up_force_redirect_url"),
      defaultRedirectPath,
    ];

    const safeCandidate = redirectCandidates.find((value) => typeof value === "string" && value.startsWith("/"));
    return safeCandidate ?? "/account";
  }, [defaultRedirectPath, searchParams]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setShowManualActions(true);
    }, 5000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      return;
    }

    router.replace(resolvedRedirectPath);
  }, [isLoaded, isSignedIn, resolvedRedirectPath, router]);

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
        {showManualActions ? (
          <div className="mt-6 rounded-[18px] border border-[#ebe4da] bg-[#fffaf6] px-4 py-4 text-left text-[14px] leading-6 text-[#5b6473]">
            <div className="font-semibold text-[#111827]">La redirection prend trop de temps ?</div>
            <div className="mt-2">Vous pouvez revenir au site sans perdre votre session.</div>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <Link href={resolvedRedirectPath} className="inline-flex h-11 items-center justify-center rounded-[14px] bg-[#ff6a00] px-5 text-[14px] font-semibold text-white transition hover:bg-[#eb6100]">
                Retourner au site
              </Link>
              <Link href="/register" className="inline-flex h-11 items-center justify-center rounded-[14px] border border-[#d7dce5] px-5 text-[14px] font-semibold text-[#222] transition hover:border-[#ff6a00] hover:text-[#ff6a00]">
                Revenir a l&apos;inscription
              </Link>
            </div>
          </div>
        ) : null}
      </div>
      <AuthenticateWithRedirectCallback
        signInUrl="/login"
        signUpUrl="/register"
        signInFallbackRedirectUrl={defaultRedirectPath}
        signUpFallbackRedirectUrl={defaultRedirectPath}
        signInForceRedirectUrl={resolvedRedirectPath}
        signUpForceRedirectUrl={resolvedRedirectPath}
      />
    </div>
  );
}
