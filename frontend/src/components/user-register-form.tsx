"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type UserRegisterFormProps = {
  nextPath: string;
  loginHref: string;
  submitLabel: string;
};

export function UserRegisterForm({ nextPath, loginHref, submitLabel }: UserRegisterFormProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({ displayName, email, password }),
      });
      const payload = await response.json().catch(() => null) as { message?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.message ?? "Inscription impossible.");
      }

      router.replace(nextPath);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Inscription impossible.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-[30px] border border-white/70 bg-white/95 p-5 shadow-none sm:p-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block text-[14px] font-semibold text-[#344054]">
          Nom complet
          <input
            type="text"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            autoComplete="name"
            required
            className="mt-2 h-13 w-full rounded-[18px] border border-[#d7dce5] bg-white px-4 text-[15px] text-[#1d2738] shadow-none outline-none focus:border-[#242936]"
          />
        </label>

        <label className="block text-[14px] font-semibold text-[#344054]">
          Adresse e-mail
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
            className="mt-2 h-13 w-full rounded-[18px] border border-[#d7dce5] bg-white px-4 text-[15px] text-[#1d2738] shadow-none outline-none focus:border-[#242936]"
          />
        </label>

        <label className="block text-[14px] font-semibold text-[#344054]">
          Mot de passe
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            required
            className="mt-2 h-13 w-full rounded-[18px] border border-[#d7dce5] bg-white px-4 text-[15px] text-[#1d2738] shadow-none outline-none focus:border-[#242936]"
          />
        </label>

        {errorMessage ? (
          <div className="rounded-[16px] bg-[#fff1f2] px-4 py-3 text-[14px] font-medium text-[#b42318] ring-1 ring-[#f5c2c7]">
            {errorMessage}
          </div>
        ) : null}

        <button type="submit" disabled={isSubmitting} className="h-14 w-full rounded-full bg-[#242936] text-[15px] font-semibold text-white transition hover:bg-[#1c212c] disabled:cursor-not-allowed disabled:opacity-70">
          {isSubmitting ? "Creation..." : submitLabel}
        </button>
      </form>

      <div className="mt-5 text-center text-[13px] text-[#667085]">
        <a href={loginHref} className="font-semibold text-[#111827] transition hover:text-[#ff6a00]">
          Vous avez deja un compte ? Connexion
        </a>
      </div>
    </div>
  );
}