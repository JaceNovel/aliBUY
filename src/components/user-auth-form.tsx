"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

type UserAuthFormProps = {
  mode: "login" | "register";
  nextPath?: string;
};

function getSafeNextPath(nextPath?: string) {
  if (nextPath && nextPath.startsWith("/")) {
    return nextPath;
  }

  return "/account";
}

export function UserAuthForm({ mode, nextPath }: UserAuthFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const safeNextPath = getSafeNextPath(nextPath);
  const isRegister = mode === "register";
  const alternatePath = isRegister
    ? `/login${nextPath ? `?next=${encodeURIComponent(safeNextPath)}` : ""}`
    : `/register${nextPath ? `?next=${encodeURIComponent(safeNextPath)}` : ""}`;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (isRegister && password !== confirmPassword) {
      setError("La confirmation du mot de passe ne correspond pas.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/auth/${mode}`, {
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
        setError(payload?.message ?? "Une erreur est survenue.");
        return;
      }

      const destination = mode === "login" && payload?.isAdmin
        ? (safeNextPath.startsWith("/admin") ? safeNextPath : "/admin")
        : safeNextPath;

      router.push(destination);
      router.refresh();
    } catch {
      setError("Impossible de finaliser la demande pour le moment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3 sm:space-y-4">
      <label className="block text-[14px] font-semibold text-[#344054]">
        Adresse e-mail
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          required
          className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] outline-none transition focus:border-[#ff6a00] sm:h-12 sm:rounded-[16px] sm:text-[15px]"
        />
      </label>

      <label className="block text-[14px] font-semibold text-[#344054]">
        Mot de passe
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete={isRegister ? "new-password" : "current-password"}
          minLength={8}
          required
          className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] outline-none transition focus:border-[#ff6a00] sm:h-12 sm:rounded-[16px] sm:text-[15px]"
        />
      </label>

      {isRegister ? (
        <label className="block text-[14px] font-semibold text-[#344054]">
          Confirmer le mot de passe
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
            className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] outline-none transition focus:border-[#ff6a00] sm:h-12 sm:rounded-[16px] sm:text-[15px]"
          />
        </label>
      ) : null}

      {!isRegister ? (
        <div className="flex items-center justify-end">
          <Link href="/forgot-password" className="text-[13px] font-semibold text-[#ff6a00] transition hover:text-[#d95a00]">
            Mot de passe oublie ?
          </Link>
        </div>
      ) : null}

      {error ? <div className="rounded-[14px] bg-[#fff2f0] px-4 py-3 text-[13px] text-[#b42318] sm:rounded-[16px] sm:text-[14px]">{error}</div> : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex h-11 w-full items-center justify-center rounded-[14px] bg-[#ff6a00] px-5 text-[14px] font-semibold text-white transition hover:bg-[#eb6100] disabled:cursor-not-allowed disabled:opacity-60 sm:h-12 sm:rounded-[16px] sm:text-[15px]"
      >
        {isSubmitting ? "Traitement..." : isRegister ? "Creer mon compte" : "Se connecter"}
      </button>

      {!isRegister ? (
        <Link
          href={alternatePath}
          className="inline-flex h-11 w-full items-center justify-center rounded-[14px] border border-[#d7dce5] px-5 text-[14px] font-semibold text-[#222] transition hover:border-[#ff6a00] hover:text-[#ff6a00] sm:h-12 sm:rounded-[16px] sm:text-[15px]"
        >
          S'inscrire
        </Link>
      ) : null}

      <div className="text-[12px] text-[#667085] sm:text-[13px]">
        {isRegister ? "Vous avez deja un compte ? " : "Vous n'avez pas encore de compte ? "}
        <Link
          href={alternatePath}
          className="font-semibold text-[#ff6a00] transition hover:text-[#d95a00]"
        >
          {isRegister ? "Connexion" : "Inscription"}
        </Link>
      </div>
    </form>
  );
}