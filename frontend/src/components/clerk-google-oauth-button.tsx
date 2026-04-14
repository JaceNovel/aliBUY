"use client";

import { useSignIn, useSignUp } from "@clerk/nextjs";
import { useState } from "react";

type ClerkGoogleOauthButtonProps = {
  mode: "sign-in" | "sign-up";
  nextPath: string;
};

function GoogleIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.25-.95 2.3-2.02 3.01l3.27 2.54c1.9-1.75 2.99-4.33 2.99-7.4 0-.71-.06-1.4-.2-2.04H12Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.63-2.45l-3.27-2.54c-.9.61-2.05.98-3.36.98-2.58 0-4.76-1.74-5.54-4.08H3.08v2.62A9.99 9.99 0 0 0 12 22Z" />
      <path fill="#4A90E2" d="M6.46 13.9A6 6 0 0 1 6.15 12c0-.66.11-1.3.31-1.9V7.48H3.08A10 10 0 0 0 2 12c0 1.61.38 3.13 1.08 4.52l3.38-2.62Z" />
      <path fill="#FBBC05" d="M12 6.01c1.47 0 2.8.51 3.84 1.5l2.88-2.88C16.96 2.99 14.7 2 12 2a9.99 9.99 0 0 0-8.92 5.48l3.38 2.62c.78-2.35 2.96-4.09 5.54-4.09Z" />
    </svg>
  );
}

function extractErrorMessage(error: unknown) {
  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  if (error && typeof error === "object") {
    const maybeErrors = (error as { errors?: Array<{ longMessage?: string; message?: string }> }).errors;
    if (Array.isArray(maybeErrors) && maybeErrors.length > 0) {
      const first = maybeErrors[0];
      if (typeof first?.longMessage === "string" && first.longMessage.trim()) {
        return first.longMessage.trim();
      }
      if (typeof first?.message === "string" && first.message.trim()) {
        return first.message.trim();
      }
    }

    const maybeMessage = (error as { message?: string }).message;
    if (typeof maybeMessage === "string" && maybeMessage.trim()) {
      return maybeMessage.trim();
    }
  }

  return "La connexion Google a echoue. Reessayez.";
}

export function ClerkGoogleOauthButton({ mode, nextPath }: ClerkGoogleOauthButtonProps) {
  const { signIn, fetchStatus: signInFetchStatus } = useSignIn();
  const { signUp, fetchStatus: signUpFetchStatus } = useSignUp();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleClick = async () => {
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const origin = window.location.origin;
      const redirectUrl = new URL(nextPath, origin).toString();
      const redirectCallbackUrl = new URL(mode === "sign-in" ? "/login/sso-callback" : "/register/sso-callback", origin).toString();

      if (mode === "sign-in") {
        if (signInFetchStatus !== "idle" || !signIn) {
          throw new Error("Le service de connexion Google n est pas encore pret.");
        }

        await signIn.sso({
          strategy: "oauth_google",
          redirectUrl,
          redirectCallbackUrl,
        });

        return;
      }

      if (signUpFetchStatus !== "idle" || !signUp) {
        throw new Error("Le service d inscription Google n est pas encore pret.");
      }

      await signUp.sso({
        strategy: "oauth_google",
        redirectUrl,
        redirectCallbackUrl,
      });
    } catch (error) {
      setErrorMessage(extractErrorMessage(error));
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={isSubmitting}
        className="flex h-12 w-full items-center justify-center gap-3 rounded-[16px] border border-[#d8dde6] bg-white px-4 text-[15px] font-semibold text-[#111827] shadow-none transition hover:border-[#ffcfab] hover:bg-[#fff8f3] disabled:cursor-not-allowed disabled:opacity-70"
      >
        <GoogleIcon className="h-5 w-5 shrink-0" />
        <span>{isSubmitting ? "Connexion Google..." : "Continuer avec Google"}</span>
      </button>

      {errorMessage ? (
        <div className="rounded-[16px] bg-[#fff1f2] px-4 py-3 text-[14px] font-medium text-[#b42318] ring-1 ring-[#f5c2c7]">
          {errorMessage}
        </div>
      ) : isSubmitting ? (
        <div className="rounded-[16px] bg-[#fff8f1] px-4 py-3 text-[14px] font-medium text-[#c2410c] ring-1 ring-[#fed7aa]">
          Redirection Google en cours. Si rien ne s ouvre, verifiez la configuration Clerk du domaine et des URLs de redirection.
        </div>
      ) : null}
    </div>
  );
}
