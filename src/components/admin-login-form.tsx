"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type AdminLoginFormProps = {
  nextPath?: string;
};

export function AdminLoginForm({ nextPath }: AdminLoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.message || "Connexion impossible.");
      }

      router.replace(nextPath && nextPath.startsWith("/admin") ? nextPath : "/admin");
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Connexion impossible.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block text-[13px] font-semibold text-[#344054]">
        Email
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="afripay@gmail.com"
          className="mt-2 h-12 w-full rounded-[16px] border border-[#d7dce5] px-4 text-[15px] text-[#111827] outline-none transition focus:border-[#ff6a00]"
        />
      </label>
      <label className="block text-[13px] font-semibold text-[#344054]">
        Mot de passe
        <input
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          placeholder="Votre mot de passe"
          className="mt-2 h-12 w-full rounded-[16px] border border-[#d7dce5] px-4 text-[15px] text-[#111827] outline-none transition focus:border-[#ff6a00]"
        />
      </label>
      {errorMessage ? <div className="rounded-[16px] bg-[#fff1f2] px-4 py-3 text-[13px] font-semibold text-[#b42318]">{errorMessage}</div> : null}
      <button
        type="submit"
        disabled={isSubmitting || email.length === 0 || password.length === 0}
        className="inline-flex h-12 w-full items-center justify-center rounded-full bg-[#ff6a00] px-6 text-[15px] font-semibold text-white transition hover:bg-[#e55e00] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isSubmitting ? "Connexion..." : "Se connecter"}
      </button>
    </form>
  );
}