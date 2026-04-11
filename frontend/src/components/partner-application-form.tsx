"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BadgeCheck, Cable, ChevronRight, Cog, CreditCard, ShieldCheck, Sparkles } from "lucide-react";

import type { PartnerPortalAccess } from "@/lib/partner-portal";

type PartnerApplicationFormProps = {
  initialAccess: PartnerPortalAccess;
  loginHref: string;
  registerHref: string;
  goLiveHref: string;
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

function PartnerIllustrationCard() {
  return (
    <section className="overflow-hidden rounded-[30px] border border-[#dde8f0] bg-[linear-gradient(180deg,#f6fbff_0%,#edf7ff_100%)] p-5 shadow-[0_18px_40px_rgba(17,24,39,0.06)]">
      <div className="relative h-[280px] overflow-hidden rounded-[24px] border border-white/60 bg-[radial-gradient(circle_at_top_left,#ffffff_0%,#eef7ff_42%,#d9eefc_100%)]">
        <div className="absolute inset-5 rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.72)_0%,rgba(233,244,255,0.46)_100%)]" />
        <div className="absolute -left-6 top-5 h-20 w-20 rounded-full bg-white/55 blur-2xl" />
        <div className="absolute right-10 top-8 h-24 w-24 rounded-full bg-[#cdeeff]/65 blur-2xl" />
        <div className="absolute left-5 top-5 flex h-14 w-14 items-center justify-center rounded-[18px] border border-[#d7e6f1] bg-white/85 text-[#39a8c8] shadow-[0_12px_30px_rgba(17,24,39,0.08)]">
          <ShieldCheck className="h-7 w-7" />
        </div>
        <div className="absolute right-5 top-5 rounded-[18px] border border-[#dbe8f2] bg-white/85 px-4 py-3 text-right shadow-[0_12px_30px_rgba(17,24,39,0.06)]">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7c8b99]">Partnership</div>
          <div className="mt-1 text-[15px] font-bold text-[#142133]">API access</div>
        </div>
        <div className="absolute inset-x-10 bottom-5 h-16 rounded-[28px] bg-white/45 blur-xl" />
        <svg viewBox="0 0 420 280" className="absolute inset-0 h-full w-full" aria-hidden="true">
          <defs>
            <linearGradient id="partnerCardBg" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#eff8ff" />
            </linearGradient>
            <linearGradient id="partnerApiBg" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="#0f9b6b" />
              <stop offset="100%" stopColor="#49c5a0" />
            </linearGradient>
            <linearGradient id="partnerPanelBg" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="#172538" />
              <stop offset="100%" stopColor="#27415f" />
            </linearGradient>
          </defs>

          <rect x="84" y="54" width="252" height="162" rx="34" fill="url(#partnerCardBg)" stroke="#d8e7f2" />
          <rect x="108" y="80" width="78" height="112" rx="24" fill="#f8fbff" stroke="#dbe8f2" />
          <rect x="234" y="80" width="78" height="112" rx="24" fill="#f8fbff" stroke="#dbe8f2" />

          <rect x="121" y="96" width="52" height="30" rx="14" fill="#dff7ef" />
          <rect x="126" y="102" width="42" height="18" rx="9" fill="url(#partnerApiBg)" />
          <rect x="120" y="136" width="54" height="42" rx="16" fill="#ffffff" stroke="#dce8f2" />
          <rect x="128" y="145" width="38" height="8" rx="4" fill="#cad7e2" />
          <rect x="128" y="159" width="24" height="6" rx="3" fill="#e2ebf2" />
          <rect x="152" y="159" width="12" height="6" rx="3" fill="#9fdcc7" />

          <rect x="247" y="96" width="52" height="30" rx="14" fill="#eef4ff" />
          <rect x="254" y="102" width="38" height="18" rx="9" fill="#304a6d" />
          <rect x="246" y="136" width="54" height="42" rx="16" fill="#ffffff" stroke="#dce8f2" />
          <rect x="254" y="145" width="38" height="8" rx="4" fill="#cad7e2" />
          <rect x="254" y="159" width="18" height="6" rx="3" fill="#e2ebf2" />
          <rect x="274" y="159" width="18" height="6" rx="3" fill="#9bc4ff" />

          <path d="M182 111 C203 111, 216 111, 238 111" stroke="#6bc8ab" strokeWidth="5" strokeLinecap="round" strokeDasharray="10 9" />
          <circle cx="210" cy="111" r="19" fill="#ffffff" stroke="#d7e6f1" />
          <path d="M198 111 h24" stroke="#6b7a89" strokeWidth="4" strokeLinecap="round" />
          <path d="M216 103 l8 8 -8 8" fill="none" stroke="#6b7a89" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />

          <rect x="148" y="205" width="124" height="24" rx="12" fill="#ffffff" opacity="0.85" />
          <circle cx="162" cy="217" r="5" fill="#35b989" />
          <rect x="173" y="212" width="54" height="10" rx="5" fill="#d8e7f2" />
          <rect x="233" y="212" width="24" height="10" rx="5" fill="#bfe6d8" />

          <rect x="282" y="142" width="108" height="72" rx="22" fill="#f7fbff" stroke="#d8e7f2" />
          <rect x="290" y="150" width="108" height="72" rx="22" fill="#ffffff" opacity="0.92" />
          <rect x="304" y="164" width="26" height="26" rx="9" fill="url(#partnerPanelBg)" />
          <path d="M312 177 h10" stroke="#eff8ff" strokeWidth="3" strokeLinecap="round" />
          <path d="M317 172 v10" stroke="#eff8ff" strokeWidth="3" strokeLinecap="round" />
          <text x="338" y="173" fontSize="15" fill="#18283b" fontFamily="sans-serif" fontWeight="700">AfriBuy API</text>
          <text x="338" y="191" fontSize="12" fill="#6a7a89" fontFamily="sans-serif">Connecte votre activité</text>

          <rect x="298" y="198" width="82" height="7" rx="3.5" fill="#d7e5f0" />
          <rect x="298" y="198" width="34" height="7" rx="3.5" fill="#8ec8ff" />

          <rect x="44" y="182" width="90" height="54" rx="18" fill="#ffffff" opacity="0.86" />
          <text x="58" y="204" fontSize="11" fill="#7a8a99" fontFamily="sans-serif">Vendor setup</text>
          <rect x="58" y="212" width="62" height="8" rx="4" fill="#d9e7f1" />
          <rect x="58" y="224" width="38" height="6" rx="3" fill="#b9e5d7" />
        </svg>
      </div>
    </section>
  );
}

function PartnerFeatureCard({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof ShieldCheck;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-[24px] border border-[#e6edf3] bg-white p-5 shadow-[0_14px_30px_rgba(17,24,39,0.04)]">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-[#eef8ff] text-[#5ab2d1]">
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <h3 className="text-[16px] font-bold text-[#142133]">{title}</h3>
          <p className="mt-2 text-[14px] leading-7 text-[#5e6b79]">{text}</p>
        </div>
      </div>
    </div>
  );
}

function PartnerBottomCta({ goLiveHref }: { goLiveHref: string }) {
  return (
    <section className="rounded-[28px] border border-[#dce8f2] bg-[linear-gradient(180deg,#eef7ff_0%,#f7fbff_100%)] px-6 py-8 text-center shadow-[0_18px_40px_rgba(17,24,39,0.05)] sm:px-8">
      <h3 className="mx-auto max-w-[760px] text-[24px] font-bold tracking-[-0.04em] text-[#142133] sm:text-[32px]">
        Demandez à devenir partenaire dès maintenant et optimisez votre e-commerce en Afrique
      </h3>
      <p className="mx-auto mt-3 max-w-[680px] text-[15px] leading-7 text-[#5e6b79]">
        Déposez votre demande, recevez une validation manuelle, puis accédez à votre environnement privé, vos outils et votre espace LIVE.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <a href="#partner-form" className="inline-flex h-12 items-center justify-center rounded-[16px] bg-[#119b6a] px-6 text-[15px] font-semibold text-white transition hover:bg-[#0f875d]">
          Devenir partenaire
        </a>
        <Link href={goLiveHref} className="inline-flex h-12 items-center justify-center gap-2 rounded-[16px] border border-[#c9d8e6] bg-white px-6 text-[15px] font-semibold text-[#142133] transition hover:border-[#119b6a] hover:text-[#119b6a]">
          Go to LIVE
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

export function PartnerApplicationForm({ initialAccess, loginHref, registerHref, goLiveHref }: PartnerApplicationFormProps) {
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
      <div className="space-y-6">
        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <section id="partner-form" className="rounded-[30px] border border-[#dce7f1] bg-white p-6 shadow-[0_20px_50px_rgba(17,24,39,0.08)] sm:p-8">
            <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#119b6a]">Connexion requise</div>
            <h2 className="mt-3 text-[28px] font-black tracking-[-0.05em] text-[#142133] sm:text-[36px]">Connectez votre compte avant de devenir partenaire</h2>
            <p className="mt-4 max-w-[720px] text-[15px] leading-8 text-[#5e6b79]">
              La demande est liée à votre compte utilisateur. C’est ce compte exact qui recevra ensuite l’accès partenaire, les API dédiées et l’entrée vers votre LIVE privé.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[22px] border border-[#e7eef5] bg-[#f9fcff] px-5 py-4">
                <div className="text-[13px] font-semibold text-[#142133]">Compte lié</div>
                <div className="mt-2 text-[14px] leading-7 text-[#5e6b79]">Un seul compte porte la demande, l’approbation et le dashboard.</div>
              </div>
              <div className="rounded-[22px] border border-[#e7eef5] bg-[#f9fcff] px-5 py-4">
                <div className="text-[13px] font-semibold text-[#142133]">Validation manuelle</div>
                <div className="mt-2 text-[14px] leading-7 text-[#5e6b79]">Le dashboard reste fermé tant que l’équipe n’a pas validé votre dossier.</div>
              </div>
            </div>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href={loginHref} className="inline-flex h-12 items-center justify-center rounded-[16px] bg-[#119b6a] px-5 text-[14px] font-semibold text-white transition hover:bg-[#0f875d]">Se connecter pour candidater</Link>
              <Link href={registerHref} className="inline-flex h-12 items-center justify-center rounded-[16px] border border-[#c8d8e5] bg-white px-5 text-[14px] font-semibold text-[#142133] transition hover:border-[#119b6a] hover:text-[#119b6a]">Créer un compte vendeur</Link>
            </div>
          </section>

          <div className="space-y-5">
            <PartnerIllustrationCard />
            <div className="grid gap-5 sm:grid-cols-2">
              <PartnerFeatureCard icon={ShieldCheck} title="API Sécurisée" text="Accédez à une API robuste et protégée pour vos opérations e-commerce." />
              <PartnerFeatureCard icon={Cog} title="Outils performants" text="Utilisez nos outils avancés pour piloter vos transactions et votre croissance." />
            </div>
          </div>
        </div>
        <PartnerBottomCta goLiveHref={goLiveHref} />
      </div>
    );
  }

  if (access.status === "approved" && access.partner) {
    return (
      <div className="space-y-6">
        <div id="partner-form" className="rounded-[30px] border border-[#cfe5d8] bg-[linear-gradient(180deg,#f4fff8_0%,#ffffff_100%)] p-6 shadow-[0_20px_50px_rgba(17,24,39,0.08)] sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#cfe5d8] bg-white px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#119b6a]">
                <BadgeCheck className="h-4 w-4" />
                Compte approuvé
              </div>
              <h2 className="mt-4 text-[28px] font-black tracking-[-0.05em] text-[#142133] sm:text-[38px]">Vous êtes déjà partenaire AfriPay</h2>
              <p className="mt-4 max-w-[760px] text-[15px] leading-8 text-[#5e6b79]">
                Le compte <span className="font-semibold text-[#142133]">{access.email}</span> a été validé. Votre entreprise dispose maintenant de son dashboard privé, de ses clés API dédiées et de son kit d’activation.
              </p>
            </div>
            <Link href={goLiveHref} className="inline-flex h-12 items-center justify-center gap-2 rounded-[16px] bg-[#119b6a] px-5 text-[14px] font-semibold text-white transition hover:bg-[#0f875d]">
              Go to LIVE
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-[22px] border border-[#d8e9df] bg-white px-5 py-5">
              <div className="text-[12px] uppercase tracking-[0.14em] text-[#6b7280]">Entreprise</div>
              <div className="mt-2 text-[18px] font-bold text-[#142133]">{access.partner.companyName}</div>
            </div>
            <div className="rounded-[22px] border border-[#d8e9df] bg-white px-5 py-5">
              <div className="text-[12px] uppercase tracking-[0.14em] text-[#6b7280]">Balance actuelle</div>
              <div className="mt-2 text-[18px] font-bold text-[#142133]">{new Intl.NumberFormat("fr-FR").format(access.partner.walletBalance)} CFA</div>
            </div>
            <div className="rounded-[22px] border border-[#d8e9df] bg-white px-5 py-5">
              <div className="text-[12px] uppercase tracking-[0.14em] text-[#6b7280]">Portail</div>
              <div className="mt-2 text-[18px] font-bold text-[#142133]">Accès LIVE actif</div>
            </div>
          </div>

          <div className="mt-6 rounded-[24px] border border-[#d8e9df] bg-white px-5 py-5">
            <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#119b6a]">Kit d’activation partenaire</div>
            <p className="mt-2 text-[14px] leading-7 text-[#5e6b79]">
              Téléchargez votre PDF dropshipping, votre charte partenaire et accédez directement à votre documentation API.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={goLiveHref} className="inline-flex h-12 items-center justify-center rounded-[16px] bg-[#142133] px-5 text-[14px] font-semibold text-white transition hover:bg-[#0f1a29]">Ouvrir mon dashboard</Link>
            <Link href="/api/partner/approval-guide" className="inline-flex h-12 items-center justify-center rounded-[16px] border border-[#b7dfc0] bg-white px-5 text-[14px] font-semibold text-[#067647] transition hover:border-[#0f9f4b] hover:text-[#0f9f4b]">Télécharger le PDF dropshipping AfriPay</Link>
            <Link href="/api/partner/charter" className="inline-flex h-12 items-center justify-center rounded-[16px] border border-[#cbd5e1] bg-white px-5 text-[14px] font-semibold text-[#344054] transition hover:border-[#142133] hover:text-[#142133]">Télécharger la charte partenaire</Link>
            <Link href="/dashboard/api" className="inline-flex h-12 items-center justify-center rounded-[16px] border border-[#d0d5dd] bg-white px-5 text-[14px] font-semibold text-[#344054] transition hover:border-[#142133] hover:text-[#142133]">Voir la documentation</Link>
          </div>
        </div>
        <PartnerBottomCta goLiveHref={goLiveHref} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <form id="partner-form" onSubmit={submit} className="rounded-[30px] border border-[#dce7f1] bg-white p-6 shadow-[0_20px_50px_rgba(17,24,39,0.08)] sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-[30px] font-black tracking-[-0.05em] text-[#142133] sm:text-[38px]">Déposer votre demande partenaire</h2>
            <p className="mt-4 text-[16px] leading-8 text-[#5e6b79]">Votre compte est bien connecté. Remplissez le formulaire ci-dessous pour lancer la validation partenaire.</p>
          </div>
          <div className="rounded-full border border-[#d9e5ef] bg-[#f8fbfe] px-4 py-2 text-[12px] font-semibold text-[#476073]">Compte lié: {access.email}</div>
        </div>

        <div className="mt-6 space-y-4">
          <label className="block">
            <input
              type="text"
              value={form.companyName}
              onChange={(event) => setForm((current) => ({ ...current, companyName: event.target.value }))}
              required
              placeholder="Nom de votre entreprise"
              className="h-14 w-full rounded-[16px] border border-[#d7dce5] px-4 text-[15px] outline-none transition focus:border-[#119b6a]"
            />
          </label>

          <label className="block">
            <input
              type="email"
              value={access.email}
              readOnly
              className="h-14 w-full rounded-[16px] border border-[#d7dce5] bg-[#f8fbfe] px-4 text-[15px] text-[#516273] outline-none"
            />
          </label>

          <label className="block">
            <input
              type="url"
              value={form.website}
              onChange={(event) => setForm((current) => ({ ...current, website: event.target.value }))}
              placeholder="URL de votre site web (optionnel)"
              className="h-14 w-full rounded-[16px] border border-[#d7dce5] px-4 text-[15px] outline-none transition focus:border-[#119b6a]"
            />
          </label>

          <label className="block">
            <textarea
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              maxLength={300}
              rows={5}
              required
              placeholder="Décrivez votre entreprise"
              className="w-full rounded-[16px] border border-[#d7dce5] px-4 py-3 text-[15px] outline-none transition focus:border-[#119b6a]"
            />
            <div className="mt-2 text-[12px] text-[#7b8c99]">Message : {300 - form.description.length} caractères</div>
          </label>
        </div>

        {message ? <div className="mt-4 rounded-[16px] bg-[#ecfdf3] px-4 py-3 text-[13px] text-[#027a48]">{message}</div> : null}
        {error ? <div className="mt-4 rounded-[16px] bg-[#fff2f0] px-4 py-3 text-[13px] text-[#b42318]">{error}</div> : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={isSubmitting || access.status === "pending"}
            className="inline-flex h-12 items-center justify-center rounded-[16px] bg-[#119b6a] px-6 text-[15px] font-semibold text-white transition hover:bg-[#0f875d] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Envoi en cours..." : access.status === "rejected" ? "Soumettre une nouvelle demande" : access.status === "pending" ? "Demande en attente" : "Envoyer ma demande"}
          </button>
        </div>
        </form>

        <aside className="space-y-5">
          <PartnerIllustrationCard />

          <div className="grid gap-5 sm:grid-cols-2">
            <PartnerFeatureCard icon={ShieldCheck} title="API Sécurisée" text="Accédez à notre API de e-commerce sécurisée et robuste." />
            <PartnerFeatureCard icon={Cog} title="Outils performants" text="Utilisez nos outils avancés pour gérer vos transactions." />
          </div>

          <section className="rounded-[28px] border border-[#e6edf3] bg-white p-6 shadow-[0_18px_40px_rgba(17,24,39,0.06)]">
            <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#476073]">Statut</div>
            <h3 className="mt-3 text-[24px] font-black tracking-[-0.05em] text-[#142133]">
            {access.status === "pending" ? "Validation en cours" : access.status === "rejected" ? "Demande à reprendre" : "Avant ouverture du dashboard"}
            </h3>
            <p className="mt-3 text-[15px] leading-7 text-[#5e6b79]">
              {access.status === "pending"
                ? "Votre dossier a bien été reçu. Tant qu’il n’est pas approuvé, le dashboard vendeur reste fermé et non visible."
                : access.status === "rejected"
                  ? "La demande précédente n’a pas été retenue. Vous pouvez corriger votre dossier et soumettre une nouvelle version."
                  : "Le dashboard vendeur n’est jamais public. Il n’apparaît qu’après validation manuelle du compte et ouverture de son accès spécifique."}
            </p>
            {requestDate ? <div className="mt-4 rounded-[18px] border border-[#e7eef5] bg-[#f9fcff] px-4 py-3 text-[13px] text-[#6b7280]">Dernière demande envoyée le <span className="font-semibold text-[#142133]">{requestDate}</span>.</div> : null}
          </section>

          <section className="rounded-[28px] border border-[#e6edf3] bg-white p-6 shadow-[0_18px_40px_rgba(17,24,39,0.06)]">
            <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#142133]">Ce que l’approbation débloque</div>
            <div className="mt-4 grid gap-3 text-[14px] leading-7 text-[#5e6b79]">
              <div className="rounded-[18px] border border-[#edf1f6] px-4 py-3"><Cable className="mr-2 inline h-4 w-4 text-[#5ab2d1]" />Un <span className="font-semibold text-[#142133]">dashboard privé</span> réservé au compte approuvé.</div>
              <div className="rounded-[18px] border border-[#edf1f6] px-4 py-3"><Sparkles className="mr-2 inline h-4 w-4 text-[#5ab2d1]" />Des <span className="font-semibold text-[#142133]">clés API dédiées</span> à votre entreprise.</div>
              <div className="rounded-[18px] border border-[#edf1f6] px-4 py-3"><ShieldCheck className="mr-2 inline h-4 w-4 text-[#5ab2d1]" />Des routes <span className="font-semibold text-[#142133]">non exposées</span> aux visiteurs non autorisés.</div>
              <div className="rounded-[18px] border border-[#edf1f6] px-4 py-3"><CreditCard className="mr-2 inline h-4 w-4 text-[#5ab2d1]" />Des données <span className="font-semibold text-[#142133]">cloisonnées par partenaire</span>.</div>
            </div>
          </section>
        </aside>
      </div>

      <PartnerBottomCta goLiveHref={goLiveHref} />
    </div>
  );
}
