"use client";

import Image from "next/image";
import Link from "next/link";
import { Check, Copy, Gift, Lock, LoaderCircle, Share2, ShieldCheck, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

type FreeDealCard = {
  slug: string;
  title: string;
  image: string;
  supplierName: string;
  href: string;
  compareAtLabel: string;
  freeLabel: string;
  tagText: string;
  badgeText: string;
};

type FreeDealPageClientProps = {
  config: {
    pageTitle: string;
    heroBadge: string;
    heroTitle: string;
    heroSubtitle: string;
    bannerText: string;
    ctaLabel: string;
    shareTitle: string;
    shareDescription: string;
    itemLimit: number;
    fixedPriceLabel: string;
    referralGoal: number;
    dealTagText: string;
  };
  access: {
    status: "eligible" | "blocked" | "unlocked" | "disabled";
    referralVisitCount: number;
    referralGoal: number;
    shareUrl?: string;
    referralCode?: string;
  };
  products: FreeDealCard[];
};

type CustomerFormState = {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  countryCode: string;
};

const INITIAL_FORM_STATE: CustomerFormState = {
  customerName: "",
  customerEmail: "",
  customerPhone: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postalCode: "",
  countryCode: "FR",
};

export function FreeDealPageClient({ config, access, products }: FreeDealPageClientProps) {
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);
  const [formState, setFormState] = useState<CustomerFormState>(INITIAL_FORM_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  const isSelectable = access.status === "eligible" || access.status === "unlocked";
  const isSelectionComplete = selectedSlugs.length === config.itemLimit;
  const remainingSelectionCount = Math.max(config.itemLimit - selectedSlugs.length, 0);
  const referralProgressPercent = Math.min(100, Math.round((access.referralVisitCount / Math.max(access.referralGoal, 1)) * 100));
  const canSubmit = Boolean(isSelectable
    && isSelectionComplete
    && formState.customerName.trim()
    && formState.customerEmail.trim()
    && formState.customerPhone.trim()
    && formState.addressLine1.trim()
    && formState.city.trim()
    && formState.countryCode.trim());
  const mobileCtaLabel = !isSelectable
    ? "Voir le partage"
    : canSubmit
      ? config.ctaLabel
      : isSelectionComplete
        ? "Renseigner mes infos"
        : `Choisir ${remainingSelectionCount}`;

  const selectedProducts = useMemo(
    () => products.filter((product) => selectedSlugs.includes(product.slug)),
    [products, selectedSlugs],
  );

  const toggleSelection = (slug: string) => {
    if (!isSelectable || isSubmitting) {
      return;
    }

    setSelectedSlugs((current) => {
      if (current.includes(slug)) {
        return current.filter((entry) => entry !== slug);
      }

      if (current.length >= config.itemLimit) {
        return current;
      }

      return [...current, slug];
    });
  };

  const handleFieldChange = (key: keyof CustomerFormState, value: string) => {
    setFormState((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const copyShareLink = async () => {
    if (!access.shareUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(access.shareUrl);
      setShareFeedback("Lien copie.");
    } catch {
      setShareFeedback("Impossible de copier automatiquement. Copiez le lien manuellement.");
    }
  };

  const focusCheckoutSection = () => {
    if (typeof document === "undefined") {
      return;
    }

    document.getElementById("free-deal-checkout")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const handleMobileCta = () => {
    if (canSubmit) {
      void submitCheckout();
      return;
    }

    if (!isSelectable) {
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      return;
    }

    focusCheckoutSection();
  };

  const submitCheckout = async () => {
    if (!canSubmit || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const checkoutResponse = await fetch("/api/free-deals/checkout", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          selectedSlugs,
          ...formState,
        }),
      });
      const checkoutPayload = await checkoutResponse.json().catch(() => null);

      if (!checkoutResponse.ok || !checkoutPayload?.orderId) {
        throw new Error(checkoutPayload?.message || "Impossible de preparer cette offre.");
      }

      const paymentResponse = await fetch("/api/payments/moneroo/initialize", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ orderId: checkoutPayload.orderId }),
      });
      const paymentPayload = await paymentResponse.json().catch(() => null);

      if (!paymentResponse.ok || !paymentPayload?.checkoutUrl) {
        throw new Error(paymentPayload?.message || "Impossible d'ouvrir le paiement.");
      }

      window.location.href = paymentPayload.checkoutUrl;
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Impossible d'ouvrir le paiement.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const promoCoupons = [
    {
      id: "bundle",
      value: `${config.fixedPriceLabel}`,
      label: `${config.itemLimit} articles au choix`,
      code: "FREE10",
    },
    {
      id: "share",
      value: config.dealTagText,
      label: `Retour via ${config.referralGoal} visites`,
      code: "SHARE20",
    },
  ];

  return (
    <div className="space-y-6 pb-[calc(9rem+env(safe-area-inset-bottom))] md:pb-0">
      <section className="overflow-hidden rounded-[34px] bg-[linear-gradient(135deg,#ff0069_0%,#ff2d55_30%,#ff6a00_100%)] text-white shadow-[0_24px_60px_rgba(255,45,85,0.22)]">
        <div className="border-b border-white/15 px-5 py-4 lg:px-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="text-[32px] font-black tracking-[-0.06em] sm:text-[42px]">Deal du Jour</div>
            <div className="text-[13px] font-semibold uppercase tracking-[0.16em] text-white/85 sm:text-[14px]">
              {config.bannerText} · Promo anniversaire · Jusqu&apos;a {config.dealTagText}
            </div>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {promoCoupons.map((coupon) => (
              <div key={coupon.id} className="grid grid-cols-[1fr_auto] overflow-hidden rounded-[24px] bg-white text-[#24324a] shadow-[0_16px_30px_rgba(17,24,39,0.12)]">
                <div className="px-5 py-5">
                  <div className="text-[18px] font-black tracking-[-0.04em] text-[#ff0f73] sm:text-[22px]">{coupon.value}</div>
                  <div className="mt-2 text-[15px] text-[#ff5b8a]">{coupon.label} <span className="text-[#667085]">| Code: {coupon.code}</span></div>
                </div>
                <div className="flex items-center px-4">
                  <button
                    type="button"
                    onClick={copyShareLink}
                    className="inline-flex h-12 items-center justify-center rounded-full bg-[#ff0f73] px-6 text-[14px] font-semibold text-white transition hover:bg-[#e20060]"
                  >
                    Copie
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-6 px-5 py-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-8">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/14 px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-white/95">
              <Sparkles className="h-4 w-4" />
              {config.heroBadge}
            </div>
            <h1 className="mt-4 max-w-[760px] text-[30px] font-black leading-[1.05] tracking-[-0.06em] sm:text-[42px]">
              {config.heroTitle}
            </h1>
            <p className="mt-4 max-w-[760px] text-[15px] leading-7 text-white/90 sm:text-[16px]">
              {config.heroSubtitle}
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <div className="rounded-[22px] bg-white px-5 py-4 text-[#1f2937] shadow-[0_14px_32px_rgba(15,23,42,0.12)]">
                <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#ff4f2a]">Lot fixe</div>
                <div className="mt-2 text-[28px] font-black tracking-[-0.05em]">{config.fixedPriceLabel}</div>
                <div className="mt-1 text-[13px] text-[#667085]">{config.itemLimit} article(s) au choix</div>
              </div>
              <div className="rounded-[22px] bg-white/14 px-5 py-4 backdrop-blur">
                <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-white/85">Partage</div>
                <div className="mt-2 text-[28px] font-black tracking-[-0.05em]">{config.referralGoal}</div>
                <div className="mt-1 text-[13px] text-white/85">visites uniques pour debloquer a nouveau</div>
              </div>
            </div>
          </div>

          <div className="rounded-[30px] bg-white/12 p-5 backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-white text-[#ff3566]">
                {access.status === "blocked" ? <Lock className="h-5 w-5" /> : access.status === "unlocked" ? <ShieldCheck className="h-5 w-5" /> : <Gift className="h-5 w-5" />}
              </div>
              <div>
                <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/80">Etat de l'acces</div>
                <div className="mt-1 text-[20px] font-black tracking-[-0.04em]">
                  {access.status === "blocked" ? "Bloque sur cet appareil" : access.status === "unlocked" ? "Debloque par partage" : access.status === "disabled" ? "Indisponible" : "Accessible maintenant"}
                </div>
              </div>
            </div>

            {access.status === "blocked" || access.status === "unlocked" ? (
              <div className="mt-5 rounded-[24px] bg-white px-4 py-4 text-[#1f2937]">
                <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#ff4f2a]">{config.shareTitle}</div>
                <p className="mt-2 text-[14px] leading-6 text-[#475467]">{config.shareDescription}</p>
                <div className="mt-4 h-3 overflow-hidden rounded-full bg-[#eef2f6]">
                  <div className="h-full rounded-full bg-[linear-gradient(90deg,#ff0f73_0%,#ff8a00_100%)]" style={{ width: `${referralProgressPercent}%` }} />
                </div>
                <div className="mt-2 text-[13px] font-semibold text-[#111827]">
                  {access.referralVisitCount}/{access.referralGoal} visites comptabilisees
                </div>
                {access.shareUrl ? (
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    <div className="min-w-0 flex-1 rounded-[16px] border border-[#e4e7ec] bg-[#f8fafc] px-4 py-3 text-[13px] font-medium text-[#344054]">
                      <div className="truncate">{access.shareUrl}</div>
                    </div>
                    <button
                      type="button"
                      onClick={copyShareLink}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#111827] px-5 text-[14px] font-semibold text-white transition hover:bg-black"
                    >
                      <Copy className="h-4 w-4" />
                      Copier
                    </button>
                  </div>
                ) : null}
                {shareFeedback ? <div className="mt-3 text-[13px] font-medium text-[#ff4f2a]">{shareFeedback}</div> : null}
              </div>
            ) : (
              <div className="mt-5 rounded-[24px] bg-white px-4 py-4 text-[#1f2937]">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[#fff3ea] text-[#ff4f2a]">
                    <Gift className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-[16px] font-black tracking-[-0.03em]">Choisissez exactement {config.itemLimit} article(s)</div>
                    <p className="mt-1 text-[14px] leading-6 text-[#475467]">
                      Les prix sur les cartes sont volontairement habilles pour la campagne. Le paiement reste un forfait unique de {config.fixedPriceLabel}.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {access.status === "disabled" ? (
        <section className="rounded-[30px] bg-white px-6 py-8 text-center shadow-[0_12px_36px_rgba(24,39,75,0.06)] ring-1 ring-black/5">
          <h2 className="text-[30px] font-black tracking-[-0.05em] text-[#111827]">Offre momentanement fermee</h2>
          <p className="mx-auto mt-3 max-w-[720px] text-[15px] leading-7 text-[#667085]">
            L'administration n'a pas encore active cette page ou aucun produit n'est relie a l'offre.
          </p>
        </section>
      ) : null}

      <section>
        <div className="mb-4 text-center">
          <h2 className="text-[34px] font-black tracking-[-0.06em] text-[#111827] sm:text-[48px]">Offres du jour</h2>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {products.map((product) => {
          const isSelected = selectedSlugs.includes(product.slug);
          const isDisabled = !isSelectable || (selectedSlugs.length >= config.itemLimit && !isSelected);

          return (
            <article
              key={product.slug}
              className={[
                "overflow-hidden rounded-[24px] bg-white shadow-[0_10px_32px_rgba(17,24,39,0.08)] ring-1 transition",
                isSelected ? "ring-[#ff4f2a]" : "ring-black/5",
                isDisabled ? "opacity-80" : "hover:-translate-y-1 hover:shadow-[0_18px_38px_rgba(17,24,39,0.12)]",
              ].join(" ")}
            >
              <div className="relative aspect-[0.95] bg-[#f6f7fb]">
                <Image
                  src={product.image}
                  alt={product.title}
                  fill
                  sizes="(min-width: 1280px) 23vw, (min-width: 640px) 45vw, 96vw"
                  className="object-cover"
                />
                <div className="absolute left-0 right-0 top-0 flex items-center justify-between bg-[#1fc76a] px-3 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-white">
                  <span>ALL</span>
                  <span>{product.badgeText}</span>
                </div>
                <button
                  type="button"
                  onClick={() => toggleSelection(product.slug)}
                  disabled={isDisabled}
                  className={[
                    "absolute bottom-3 right-3 inline-flex h-12 w-12 items-center justify-center rounded-full border text-white shadow-[0_14px_28px_rgba(17,24,39,0.18)] transition",
                    isSelected ? "border-[#111827] bg-[#111827]" : "border-white bg-[#ff4f2a]",
                    isDisabled ? "cursor-not-allowed opacity-70" : "hover:scale-105",
                  ].join(" ")}
                  aria-label={isSelected ? "Retirer cet article" : "Selectionner cet article"}
                >
                  {isSelected ? <Check className="h-5 w-5" /> : <Gift className="h-5 w-5" />}
                </button>
              </div>
              <div className="space-y-3 px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#15b86c]">Campagne acquisition</div>
                  <div className="rounded-full bg-[#fff1f5] px-2 py-1 text-[10px] font-bold text-[#ff275f]">{product.tagText}</div>
                </div>
                <h2 className="line-clamp-2 min-h-[48px] text-[17px] font-black leading-6 tracking-[-0.03em] text-[#111827]">
                  {product.title}
                </h2>
                <div className="text-[13px] text-[#667085]">{product.supplierName}</div>
                <div className="flex items-end gap-2">
                  <div className="text-[26px] font-black tracking-[-0.05em] text-[#ff4f2a]">{product.freeLabel}</div>
                  <div className="pb-1 text-[15px] font-semibold text-[#98a2b3] line-through">{product.compareAtLabel}</div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <Link href={product.href} prefetch={false} className="text-[13px] font-semibold text-[#111827] transition hover:text-[#ff4f2a]">
                    Voir le produit
                  </Link>
                  <div className="text-[12px] font-semibold text-[#ff4f2a]">
                    {isSelected ? "Selectionne" : "Choisir"}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <aside className="rounded-[30px] bg-white px-5 py-5 shadow-[0_10px_32px_rgba(17,24,39,0.08)] ring-1 ring-black/5 sm:px-6 sm:py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-[#fff3ea] text-[#ff4f2a]">
              <Gift className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#ff4f2a]">Votre lot</div>
              <div className="mt-1 text-[22px] font-black tracking-[-0.04em] text-[#111827]">
                {selectedSlugs.length}/{config.itemLimit} article(s)
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-[22px] bg-[#f8fafc] px-4 py-4">
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#667085]">Montant unique</div>
            <div className="mt-2 text-[32px] font-black tracking-[-0.05em] text-[#111827]">{config.fixedPriceLabel}</div>
            <div className="mt-1 text-[13px] leading-6 text-[#667085]">
              {isSelectable
                ? isSelectionComplete
                  ? "Votre lot est complet. Vous pouvez lancer le paiement."
                  : `Ajoutez encore ${remainingSelectionCount} article(s) pour continuer.`
                : "Le paiement est verrouille tant que cet acces n'est pas reautorise."}
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {selectedProducts.length > 0 ? selectedProducts.map((product, index) => (
              <div key={product.slug} className="flex items-center gap-3 rounded-[18px] bg-[#f8fafc] px-4 py-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#111827] text-[12px] font-bold text-white">
                  {index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-semibold text-[#111827]">{product.title}</div>
                  <div className="text-[12px] text-[#667085]">{product.compareAtLabel} habille sur la carte</div>
                </div>
              </div>
            )) : (
              <div className="rounded-[18px] border border-dashed border-[#d0d5dd] px-4 py-4 text-[14px] text-[#667085]">
                Aucune selection pour le moment.
              </div>
            )}
          </div>

          <div className="mt-5 rounded-[22px] bg-[#111827] px-4 py-4 text-white">
            <div className="flex items-start gap-3">
              <Share2 className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="text-[13px] leading-6 text-white/85">
                Une fois l'offre achetee sur cet appareil, l'acces sera bloque. Le retour se fait par lien partage et visites uniques.
              </div>
            </div>
          </div>
        </aside>

        <section id="free-deal-checkout" className="rounded-[30px] bg-white px-5 py-5 shadow-[0_10px_32px_rgba(17,24,39,0.08)] ring-1 ring-black/5 sm:px-6 sm:py-6">
          <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#ff4f2a]">Livraison</div>
          <h2 className="mt-2 text-[28px] font-black tracking-[-0.05em] text-[#111827]">Renseignez vos infos puis lancez le paiement</h2>
          <p className="mt-2 max-w-[760px] text-[14px] leading-7 text-[#667085]">
            Le panier est volontairement ultra simple: un lot fixe, un montant fixe, puis paiement Moneroo.
          </p>

          {feedback ? <div className="mt-5 rounded-[18px] border border-[#fed7d7] bg-[#fff1f2] px-4 py-4 text-[14px] font-medium text-[#b42318]">{feedback}</div> : null}
          {access.status === "unlocked" ? <div className="mt-5 rounded-[18px] border border-[#cfe9d9] bg-[#effbf2] px-4 py-4 text-[14px] font-medium text-[#1f7a39]">Votre acces a deja ete debloque par le partage. Vous pouvez reutiliser la page.</div> : null}
          {access.status === "blocked" ? <div className="mt-5 rounded-[18px] border border-[#f4d8c2] bg-[#fff7f1] px-4 py-4 text-[14px] font-medium text-[#8a4b16]">Le formulaire reste visible, mais le paiement ne peut plus repartir sur cet appareil tant que le partage n'a pas debloque la page.</div> : null}

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {[
              { key: "customerName", label: "Nom complet", placeholder: "Ex: Awa Traore" },
              { key: "customerEmail", label: "Email", placeholder: "client@email.com" },
              { key: "customerPhone", label: "Telephone", placeholder: "+228 ..." },
              { key: "countryCode", label: "Pays code", placeholder: "FR, TG, BJ..." },
              { key: "city", label: "Ville", placeholder: "Lome" },
              { key: "state", label: "Region / Etat", placeholder: "Maritime" },
              { key: "addressLine1", label: "Adresse", placeholder: "Rue, quartier, repere" },
              { key: "addressLine2", label: "Complement", placeholder: "Batiment, etage..." },
              { key: "postalCode", label: "Code postal", placeholder: "75001" },
            ].map((field) => (
              <label key={field.key} className={field.key === "addressLine1" ? "space-y-2 text-[13px] font-semibold text-[#344054] md:col-span-2" : "space-y-2 text-[13px] font-semibold text-[#344054]"}>
                <span>{field.label}</span>
                <input
                  value={formState[field.key as keyof CustomerFormState]}
                  onChange={(event) => handleFieldChange(field.key as keyof CustomerFormState, event.target.value)}
                  placeholder={field.placeholder}
                  className="h-12 w-full rounded-[16px] border border-[#d0d5dd] bg-white px-4 text-[14px] text-[#111827] outline-none transition focus:border-[#ff4f2a]"
                />
              </label>
            ))}
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-[14px] text-[#667085]">
              {isSelectionComplete ? `Lot complet: ${config.fixedPriceLabel}` : `Selection incomplete: ${selectedSlugs.length}/${config.itemLimit}`}
            </div>
            <button
              type="button"
              onClick={submitCheckout}
              disabled={!canSubmit || isSubmitting}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#111827] px-6 text-[15px] font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
              {isSubmitting ? "Preparation..." : config.ctaLabel}
            </button>
          </div>
        </section>
      </section>

      <div className="fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom))] z-[120] border-t border-black/10 bg-white/96 px-4 py-3 backdrop-blur md:hidden">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#98a2b3]">Lot gratuit</div>
            <div className="truncate text-[18px] font-black tracking-[-0.04em] text-[#111827]">{selectedSlugs.length}/{config.itemLimit} · {config.fixedPriceLabel}</div>
            <div className="truncate text-[12px] text-[#667085]">
              {!isSelectable ? "Acces via partage requis" : isSelectionComplete ? "Passez au formulaire" : `Encore ${remainingSelectionCount} article(s)`}
            </div>
          </div>
          <button
            type="button"
            onClick={handleMobileCta}
            disabled={isSubmitting}
            className="inline-flex h-[52px] min-w-[152px] items-center justify-center rounded-full bg-[#111827] px-5 text-[15px] font-semibold text-white shadow-[0_14px_28px_rgba(17,24,39,0.18)] transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Preparation..." : mobileCtaLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
