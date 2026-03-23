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
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const safeNextPath = getSafeNextPath(nextPath);
  const isRegister = mode === "register";

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          displayName,
          email,
          password,
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.message ?? "Une erreur est survenue.");
        return;
      }

      router.push(safeNextPath);
      router.refresh();
    } catch {
      setError("Impossible de finaliser la demande pour le moment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {isRegister ? (
        <label className="block text-[14px] font-semibold text-[#344054]">
          Nom complet
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            autoComplete="name"
            required
            className="mt-2 h-12 w-full rounded-[16px] border border-[#d7dce5] px-4 text-[15px] outline-none transition focus:border-[#ff6a00]"
          />
        </label>
      ) : null}

      <label className="block text-[14px] font-semibold text-[#344054]">
        Adresse e-mail
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          required
          className="mt-2 h-12 w-full rounded-[16px] border border-[#d7dce5] px-4 text-[15px] outline-none transition focus:border-[#ff6a00]"
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
          className="mt-2 h-12 w-full rounded-[16px] border border-[#d7dce5] px-4 text-[15px] outline-none transition focus:border-[#ff6a00]"
        />
      </label>

      {error ? <div className="rounded-[16px] bg-[#fff2f0] px-4 py-3 text-[14px] text-[#b42318]">{error}</div> : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex h-12 w-full items-center justify-center rounded-[16px] bg-[#ff6a00] px-5 text-[15px] font-semibold text-white transition hover:bg-[#eb6100] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Traitement..." : isRegister ? "Creer mon compte" : "Se connecter"}
      </button>

      <div className="text-[13px] text-[#667085]">
        {isRegister ? "Vous avez deja un compte ? " : "Vous n'avez pas encore de compte ? "}
        <Link
          href={isRegister ? `/login${nextPath ? `?next=${encodeURIComponent(safeNextPath)}` : ""}` : `/register${nextPath ? `?next=${encodeURIComponent(safeNextPath)}` : ""}`}
          className="font-semibold text-[#ff6a00] transition hover:text-[#d95a00]"
        >
          {isRegister ? "Connexion" : "Inscription"}
        </Link>
      </div>
    </form>
  );
}