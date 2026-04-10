"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { PartnerPortalAccess } from "@/lib/partner-portal";

type PartnerApplicationFormProps = {
  initialAccess: PartnerPortalAccess;
  loginHref: string;
};

type SubmissionState = {
  companyName: string;
  website: string;
  description: string;
};

function formatDate(value?: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

export function PartnerApplicationForm({ initialAccess, loginHref }: PartnerApplicationFormProps) {
  const [access, setAccess] = useState(initialAccess);
  const [form, setForm] = useState<SubmissionState>({
    companyName: initialAccess.request?.companyName || initialAccess.partner?.companyName || "",
    website: initialAccess.request?.website || initialAccess.partner?.webhookUrl || "",
    description: initialAccess.request?.description || "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requestDate = useMemo(() => formatDate(access.request?.createdAt), [access.request?.createdAt]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/partner/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.message ?? "Impossible d'envoyer votre demande partenaire.");
        return;
      }

      setAccess((current) => ({
        ...current,
        status: "pending",
        hasDashboardAccess: false,
        request: payload?.request ?? {
          companyName: form.companyName,
          website: form.website || null,
          description: form.description,
          createdAt: new Date().toISOString(),
        },
      }));
      setMessage("Votre demande partenaire a bien été transmise. L’équipe AfriPay examinera votre dossier avant d’ouvrir votre dashboard privé.");
    } catch {
      setError("Impossible d'envoyer votre demande partenaire pour le moment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (access.status === "guest" || !access.email) {
    return (
      <div className="rounded-[28px] border border-[#f0dacb] bg-[#fff7f0] p-6 shadow-[0_20px_50px_rgba(17,24,39,0.08)]">
        <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#ff6a00]">Connexion requise</div>
        <h2 className="mt-3 text-[28px] font-black tracking-[-0.05em] text-[#101828]">Connectez votre compte avant de candidater</h2>
        <p className="mt-3 text-[15px] leading-7 text-[#5f6470]">La demande partenaire est rattachée à votre compte utilisateur. C’est ce compte précis qui recevra ensuite l’accès à son dashboard et à ses propres API.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href={loginHref} className="inline-flex h-12 items-center justify-center rounded-[16px] bg-[#ff6a00] px-5 text-[14px] font-semibold text-white transition hover:bg-[#eb6200]">Se connecter pour candidater</Link>
          <Link href="/register?next=/partnership" className="inline-flex h-12 items-center justify-center rounded-[16px] border border-[#f1cdae] bg-white px-5 text-[14px] font-semibold text-[#9a4310] transition hover:border-[#ff6a00] hover:text-[#ff6a00]">Créer un compte vendeur</Link>
        </div>
      </div>
    );
  }

  if (access.status === "approved" && access.partner) {
    return (
      <div className="rounded-[28px] border border-[#cde8d3] bg-[linear-gradient(180deg,#f5fff7_0%,#ffffff_100%)] p-6 shadow-[0_20px_50px_rgba(17,24,39,0.08)]">
        <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#0f9f4b]">Compte approuvé</div>
        <h2 className="mt-3 text-[28px] font-black tracking-[-0.05em] text-[#101828]">Votre espace vendeur est prêt</h2>
        <p className="mt-3 text-[15px] leading-7 text-[#5f6470]">Le compte <span className="font-semibold text-[#111827]">{access.email}</span> a été validé. Le dashboard et les clés API affichées dedans appartiennent à cette entreprise uniquement.</p>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <div className="rounded-[20px] border border-[#dfe7df] bg-white px-4 py-4">
            <div className="text-[12px] uppercase tracking-[0.14em] text-[#667085]">Entreprise</div>
            <div className="mt-2 text-[18px] font-bold text-[#111827]">{access.partner.companyName}</div>
          </div>
          <div className="rounded-[20px] border border-[#dfe7df] bg-white px-4 py-4">
            <div className="text-[12px] uppercase tracking-[0.14em] text-[#667085]">Balance actuelle</div>
            <div className="mt-2 text-[18px] font-bold text-[#111827]">{new Intl.NumberFormat("fr-FR").format(access.partner.walletBalance)} CFA</div>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/dashboard" className="inline-flex h-12 items-center justify-center rounded-[16px] bg-[#111827] px-5 text-[14px] font-semibold text-white transition hover:bg-[#0b1220]">Ouvrir mon dashboard</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
      <form onSubmit={submit} className="rounded-[28px] border border-[#e9dccd] bg-white p-6 shadow-[0_20px_50px_rgba(17,24,39,0.08)] sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#ff6a00]">Dossier partenaire</div>
            <h2 className="mt-3 text-[28px] font-black tracking-[-0.05em] text-[#101828]">Envoyer une demande vendeur</h2>
          </div>
          <div className="rounded-full border border-[#f2d5c0] bg-[#fff7f1] px-4 py-2 text-[12px] font-semibold text-[#8e3f09]">Compte lié: {access.email}</div>
        </div>

        <p className="mt-3 text-[15px] leading-7 text-[#5f6470]">Expliquez votre activité, votre site et votre projet. L’équipe valide manuellement chaque compte avant d’ouvrir le dashboard privé et les API propres à votre entreprise.</p>

        <div className="mt-6 space-y-4">
          <label className="block text-[13px] font-semibold text-[#344054]">
            Nom de l’entreprise
            <input
              type="text"
              value={form.companyName}
              onChange={(event) => setForm((current) => ({ ...current, companyName: event.target.value }))}
              required
              className="mt-2 h-12 w-full rounded-[16px] border border-[#d7dce5] px-4 text-[14px] outline-none transition focus:border-[#ff6a00]"
            />
          </label>

          <label className="block text-[13px] font-semibold text-[#344054]">
            Site web ou boutique
            <input
              type="url"
              value={form.website}
              onChange={(event) => setForm((current) => ({ ...current, website: event.target.value }))}
              placeholder="https://votreboutique.com"
              className="mt-2 h-12 w-full rounded-[16px] border border-[#d7dce5] px-4 text-[14px] outline-none transition focus:border-[#ff6a00]"
            />
          </label>

          <label className="block text-[13px] font-semibold text-[#344054]">
            Présentez votre projet
            <textarea
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              rows={7}
              required
              className="mt-2 w-full rounded-[16px] border border-[#d7dce5] px-4 py-3 text-[14px] outline-none transition focus:border-[#ff6a00]"
            />
          </label>
        </div>

        {message ? <div className="mt-4 rounded-[16px] bg-[#ecfdf3] px-4 py-3 text-[13px] text-[#027a48]">{message}</div> : null}
        {error ? <div className="mt-4 rounded-[16px] bg-[#fff2f0] px-4 py-3 text-[13px] text-[#b42318]">{error}</div> : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={isSubmitting || access.status === "pending"}
            className="inline-flex h-12 items-center justify-center rounded-[16px] bg-[#ff6a00] px-5 text-[14px] font-semibold text-white transition hover:bg-[#eb6200] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Envoi en cours..." : access.status === "rejected" ? "Soumettre une nouvelle demande" : access.status === "pending" ? "Demande en attente" : "Envoyer ma demande"}
          </button>
        </div>
      </form>

      <aside className="space-y-5">
        <section className="rounded-[28px] border border-[#eadfd4] bg-[linear-gradient(180deg,#fff9f2_0%,#ffffff_100%)] p-6 shadow-[0_18px_40px_rgba(17,24,39,0.06)]">
          <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#8e3f09]">Statut</div>
          <h3 className="mt-3 text-[24px] font-black tracking-[-0.05em] text-[#101828]">
            {access.status === "pending" ? "Validation en cours" : access.status === "rejected" ? "Demande à reprendre" : "Avant ouverture du dashboard"}
          </h3>
          <p className="mt-3 text-[15px] leading-7 text-[#5f6470]">
            {access.status === "pending"
              ? "Votre dossier a bien été reçu. Tant qu’il n’est pas approuvé, le dashboard vendeur reste fermé et non visible."
              : access.status === "rejected"
                ? "La demande précédente n’a pas été retenue. Vous pouvez corriger votre dossier et soumettre une nouvelle version."
                : "Le dashboard vendeur n’est jamais public. Il n’apparaît qu’après validation manuelle du compte et ouverture de son accès spécifique."}
          </p>
          {requestDate ? <div className="mt-4 rounded-[18px] border border-[#f0e1d2] bg-white px-4 py-3 text-[13px] text-[#6b7280]">Dernière demande envoyée le <span className="font-semibold text-[#111827]">{requestDate}</span>.</div> : null}
        </section>

        <section className="rounded-[28px] border border-[#e5e7eb] bg-white p-6 shadow-[0_18px_40px_rgba(17,24,39,0.06)]">
          <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#111827]">Ce que l’approbation débloque</div>
          <div className="mt-4 space-y-3 text-[14px] leading-7 text-[#5f6470]">
            <div className="rounded-[18px] border border-[#edf1f6] px-4 py-3">Un <span className="font-semibold text-[#111827]">dashboard privé</span> réservé au compte approuvé.</div>
            <div className="rounded-[18px] border border-[#edf1f6] px-4 py-3">Des <span className="font-semibold text-[#111827]">clés API dédiées</span> à votre entreprise.</div>
            <div className="rounded-[18px] border border-[#edf1f6] px-4 py-3">Des routes dashboard et admin <span className="font-semibold text-[#111827]">non indexées et non exposées</span> aux visiteurs non autorisés.</div>
            <div className="rounded-[18px] border border-[#edf1f6] px-4 py-3">Des données <span className="font-semibold text-[#111827]">cloisonnées par partenaire</span>: commandes, wallet, statistiques et webhook.</div>
          </div>
        </section>
      </aside>
    </div>
  );
}