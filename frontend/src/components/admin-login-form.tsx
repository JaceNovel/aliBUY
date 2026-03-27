"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

type AdminLoginFormProps = {
  nextPath?: string;
};

export function AdminLoginForm({ nextPath = "/admin" }: AdminLoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/admin-login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.message ?? "Impossible d'ouvrir l'espace admin.");
        return;
      }

      router.replace(nextPath);
      router.refresh();
    } catch {
      setError("Impossible d'ouvrir l'espace admin pour le moment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded-[20px] border border-[#f0d7c7] bg-[#fffaf6] px-4 py-4">
      <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#ff6a00]">Acces Admin</div>
      <div className="text-[13px] leading-6 text-[#5b6473]">
        Saisissez vos identifiants pour ouvrir l&apos;administration.
      </div>

      <label className="block text-[13px] font-semibold text-[#344054]">
        Adresse e-mail admin
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          required
          className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] outline-none transition focus:border-[#ff6a00]"
        />
      </label>

      <label className="block text-[13px] font-semibold text-[#344054]">
        Mot de passe admin
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
          className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] outline-none transition focus:border-[#ff6a00]"
        />
      </label>

      {error ? <div className="rounded-[14px] bg-[#fff2f0] px-4 py-3 text-[13px] text-[#b42318]">{error}</div> : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex h-11 w-full items-center justify-center rounded-[14px] border border-[#ff6a00] px-5 text-[14px] font-semibold text-[#ff6a00] transition hover:bg-[#fff1e7] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Connexion..." : "Entrer dans l'administration"}
      </button>
    </form>
  );
}
