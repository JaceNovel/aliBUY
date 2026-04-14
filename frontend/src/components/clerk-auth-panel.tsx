"use client";

import { ClerkLoaded, ClerkLoading, SignIn, SignUp } from "@clerk/nextjs";

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
    <div className="mx-auto mt-6 min-h-[420px] w-full max-w-[480px]">
      <ClerkLoading>
        <div className="rounded-[24px] border border-[#d7dce5] bg-white/90 px-5 py-6 text-center text-[14px] font-semibold text-[#344054] shadow-[0_18px_45px_rgba(17,24,39,0.08)]">
          Chargement du formulaire securise...
        </div>
      </ClerkLoading>
      <ClerkLoaded>
        {mode === "sign-in" ? (
          <SignIn
            routing="hash"
            appearance={authPageClerkAppearance}
            signUpUrl={buildAuthSwitchUrl("/register", nextPath, reason)}
            forceRedirectUrl={nextPath}
            fallbackRedirectUrl={nextPath}
            withSignUp
            oauthFlow="redirect"
          />
        ) : (
          <SignUp
            routing="hash"
            appearance={authPageClerkAppearance}
            signInUrl={buildAuthSwitchUrl("/login", nextPath, reason)}
            forceRedirectUrl={nextPath}
            fallbackRedirectUrl={nextPath}
            oauthFlow="redirect"
          />
        )}
      </ClerkLoaded>
    </div>
  );
}
