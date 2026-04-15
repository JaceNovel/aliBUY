"use client";

import { ClerkLoaded, ClerkLoading, SignIn, SignUp } from "@clerk/nextjs";
import Link from "next/link";

import { ClerkGoogleOauthButton } from "@/components/clerk-google-oauth-button";
import { authPageClerkAppearance } from "@/lib/clerk-theme";

type ClerkAuthPanelProps = {
  mode: "sign-in" | "sign-up";
  nextPath: string;
  reason?: string;
};

function buildAuthSwitchUrl(pathname: "/login" | "/register", nextPath: string, reason?: string) {
  const params = new URLSearchParams({ next: nextPath });
  if (reason) {
    params.set("reason", reason);
  }
  return `${pathname}?${params.toString()}`;
}

export function ClerkAuthPanel({ mode, nextPath, reason }: ClerkAuthPanelProps) {
  return (
    <div className="mx-auto mt-4 min-h-[380px] w-full max-w-[480px] sm:mt-6 sm:min-h-[420px]">
      <ClerkLoading>
        <div className="rounded-[20px] border border-[#d7dce5] bg-white/90 px-4 py-5 text-center text-[13px] font-semibold text-[#344054] shadow-[0_18px_45px_rgba(17,24,39,0.08)] sm:rounded-[24px] sm:px-5 sm:py-6 sm:text-[14px]">
          Chargement du formulaire securise...
        </div>
      </ClerkLoading>
      <ClerkLoaded>
        <div className="space-y-4 sm:space-y-5">
          <ClerkGoogleOauthButton mode={mode} nextPath={nextPath} />
          {mode === "sign-in" ? (
            <div className="space-y-3">
              <SignIn
                routing="hash"
                appearance={authPageClerkAppearance}
                signUpUrl={buildAuthSwitchUrl("/register", nextPath, reason)}
                forceRedirectUrl={nextPath}
                fallbackRedirectUrl={nextPath}
                withSignUp
              />
              <div className="flex justify-end px-1">
                <Link
                  href="/forgot-password"
                  className="text-[13px] font-semibold text-[#ff6a00] transition hover:text-[#d95a00]"
                >
                  Mot de passe oublie ?
                </Link>
              </div>
            </div>
          ) : (
            <SignUp
              routing="hash"
              appearance={authPageClerkAppearance}
              signInUrl={buildAuthSwitchUrl("/login", nextPath, reason)}
              forceRedirectUrl={nextPath}
              fallbackRedirectUrl={nextPath}
            />
          )}
        </div>
      </ClerkLoaded>
    </div>
  );
}
