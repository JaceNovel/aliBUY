"use client";

import Image from "next/image";
import Link from "next/link";
import { Check, Copy, Gift, LoaderCircle, MapPin, ShoppingCart, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useCart } from "@/components/cart-provider";
import { buildApiUrl } from "@/lib/api";

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
  initialCustomer: CustomerFormState & {
    hasDefaultAddress: boolean;
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

const FREE_DEAL_CART_STORAGE_KEY = "afripay_free_deal_cart_v1";

export function FreeDealPageClient({ config, access, initialCustomer, products }: FreeDealPageClientProps) {
  const { items: standardCartItems, clearCart } = useCart();
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);
  const [formState, setFormState] = useState<CustomerFormState>({
    ...INITIAL_FORM_STATE,
    ...initialCustomer,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(false);

  const isSelectable = access.status === "eligible" || access.status === "unlocked";
  const isSelectionComplete = selectedSlugs.length === config.itemLimit;
  const remainingSelectionCount = Math.max(config.itemLimit - selectedSlugs.length, 0);
  const canSubmit = Boolean(isSelectable
    && isSelectionComplete
    && formState.customerName.trim()
    && formState.customerEmail.trim()
    && formState.customerPhone.trim()
    && formState.addressLine1.trim()
    && formState.city.trim()
    && formState.countryCode.trim());
  const hasStandardCartConflict = standardCartItems.length > 0;
  const mobileCtaLabel = hasStandardCartConflict
    ? "Vider panier"
    : !isSelectable
      ? "Offre indisponible"
      : canSubmit
        ? config.ctaLabel
        : isSelectionComplete
          ? "Adresse"
          : `Choisir ${remainingSelectionCount}`;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const stored = window.localStorage.getItem(FREE_DEAL_CART_STORAGE_KEY);
    if (!stored) {
      return;
    }

    try {
      const parsed = JSON.parse(stored) as string[];
      if (!Array.isArray(parsed)) {
        return;
      }

      const allowedSlugs = new Set(products.map((product) => product.slug));
      const nextSelection = parsed
        .filter((slug): slug is string => typeof slug === "string" && allowedSlugs.has(slug))
        .slice(0, config.itemLimit);
      setSelectedSlugs(nextSelection);
    } catch {
      window.localStorage.removeItem(FREE_DEAL_CART_STORAGE_KEY);
    }
  }, [config.itemLimit, products]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(FREE_DEAL_CART_STORAGE_KEY, JSON.stringify(selectedSlugs));
  }, [selectedSlugs]);

  const totalCartSlots = config.itemLimit;
  const addressSummary = [formState.addressLine1, formState.addressLine2, `${formState.city}${formState.state ? `, ${formState.state}` : ""}`, formState.postalCode, formState.countryCode]
    .filter(Boolean)
    .join(" · ");

  const hasAddressDetails = Boolean(
    formState.customerName.trim()
    && formState.customerEmail.trim()
    && formState.customerPhone.trim()
    && formState.addressLine1.trim()
    && formState.city.trim()
    && formState.countryCode.trim(),
  );

  const openAddressForm = () => {
    setShowAddressForm(true);
    if (typeof document === "undefined") {
      return;
    }

    document.getElementById("free-deal-address")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const closeAddressForm = () => {
    setShowAddressForm(false);
  };

  const clearFreeDealCart = () => {
    setSelectedSlugs([]);
    setFeedback(null);
  };

  const clearStandardCart = () => {
    clearCart();
    setFeedback(null);
  };

  const statusMessage = hasStandardCartConflict
    ? "Votre panier standard contient deja des articles. Videz-le avant d'utiliser cette offre."
    : canSubmit
      ? config.ctaLabel
      : isSelectionComplete
        ? "Ajoutez votre adresse puis reglez les 10 EUR."
        : `Ajoutez encore ${remainingSelectionCount} article(s) dans le panier gratuit.`;

  const selectedProducts = useMemo(
    () => products.filter((product) => selectedSlugs.includes(product.slug)),
    [products, selectedSlugs],
  );

  const toggleSelection = (slug: string) => {
    if (!isSelectable || isSubmitting || hasStandardCartConflict) {
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
    if (hasStandardCartConflict) {
      clearStandardCart();
      return;
    }

    if (canSubmit) {
      void submitCheckout();
      return;
    }

    if (!isSelectable) {
      return;
    }

    if (isSelectionComplete) {
      openAddressForm();
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

      if (typeof checkoutPayload.checkoutUrl === "string" && checkoutPayload.checkoutUrl.length > 0) {
        window.location.href = checkoutPayload.checkoutUrl;
        return;
      }

      const paymentResponse = await fetch(buildApiUrl("/api/payments/init"), {
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
    <div className="space-y-6 pb-[calc(11rem+env(safe-area-inset-bottom))] md:pb-0">
      <section className="relative left-1/2 right-1/2 -mx-[50vw] w-screen overflow-hidden bg-[linear-gradient(90deg,#ff0069_0%,#ff3358_38%,#ff6a00_100%)] text-white shadow-[0_24px_60px_rgba(255,45,85,0.18)]">
        <div className="px-4 py-3 sm:px-6 lg:px-10">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="text-[24px] font-black tracking-[-0.06em] sm:text-[34px]">Deal du Jour</div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/85 sm:text-[13px]">
              Article gratuit des 10 euro · promo anniversaire · jusqu&apos;a {config.dealTagText}
            </div>
          </div>
          <div className="mt-3 grid gap-2 lg:grid-cols-2">
            {promoCoupons.map((coupon) => (
              <div key={coupon.id} className="flex flex-col gap-2 overflow-hidden rounded-[20px] bg-white p-3 text-[#24324a] shadow-[0_10px_24px_rgba(17,24,39,0.1)] sm:grid sm:grid-cols-[1fr_auto] sm:gap-0 sm:p-0">
                <div className="px-4 py-3 sm:px-5 sm:py-4">
                  <div className="text-[16px] font-black tracking-[-0.04em] text-[#ff0f73] sm:text-[20px]">{coupon.value}</div>
                  <div className="mt-1 text-[13px] text-[#ff5b8a]">{coupon.label} <span className="text-[#667085]">| Code: {coupon.code}</span></div>
                </div>
                <div className="flex items-center px-1 sm:px-3">
                  <button
                    type="button"
                    onClick={copyShareLink}
                    className="inline-flex h-10 w-full items-center justify-center rounded-full bg-[#ff0f73] px-5 text-[13px] font-semibold text-white transition hover:bg-[#e20060] sm:w-auto"
                  >
                    Copie
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:px-10 lg:py-5">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/14 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/95 sm:px-4 sm:py-2 sm:text-[12px]">
              <Sparkles className="h-4 w-4" />
              {config.heroBadge}
            </div>
            <h1 className="mt-3 max-w-[760px] text-[26px] font-black leading-[1.02] tracking-[-0.06em] sm:text-[38px] lg:text-[44px]">
              {config.heroTitle}
            </h1>
            <p className="mt-3 max-w-[760px] text-[14px] leading-6 text-white/90 sm:text-[15px]">
              {config.heroSubtitle}
            </p>

            <div className="mt-4 flex flex-wrap gap-2.5">
              <div className="rounded-[20px] bg-white px-4 py-3 text-[#1f2937] shadow-[0_14px_32px_rgba(15,23,42,0.12)]">
                <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#ff4f2a]">Lot fixe</div>
                <div className="mt-1 text-[22px] font-black tracking-[-0.05em] sm:text-[26px]">{config.fixedPriceLabel}</div>
                <div className="mt-1 text-[13px] text-[#667085]">{config.itemLimit} article(s) au choix</div>
              </div>
              <div className="rounded-[20px] bg-white/14 px-4 py-3 backdrop-blur">
                <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-white/85">Partage</div>
                <div className="mt-1 text-[22px] font-black tracking-[-0.05em] sm:text-[26px]">{config.referralGoal}</div>
                <div className="mt-1 text-[13px] text-white/85">visites uniques pour debloquer a nouveau</div>
              </div>
            </div>
          </div>

          <div className="rounded-[26px] bg-white/12 p-4 backdrop-blur sm:p-5">
            <div className="rounded-[20px] bg-white px-4 py-4 text-[#1f2937]">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[#fff3ea] text-[#ff4f2a]">
                  <ShoppingCart className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[16px] font-black tracking-[-0.03em]">Ajoutez {config.itemLimit} article(s) dans le panier gratuit</div>
                  <p className="mt-1 text-[14px] leading-6 text-[#475467]">
                    Les articles de cette offre restent dans un panier separe. Ils ne se melangent pas avec votre panier normal.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-3 rounded-[20px] bg-white/10 px-4 py-4 text-white">
              <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/78">Statut rapide</div>
              <div className="mt-2 text-[18px] font-black tracking-[-0.04em]">
                {statusMessage}
              </div>
              {shareFeedback ? <div className="mt-2 text-[12px] font-semibold text-white/80">{shareFeedback}</div> : null}
            </div>
          </div>
        </div>
      </section>

      {access.status === "disabled" ? (
        <section className="rounded-[30px] bg-white px-6 py-8 text-center shadow-[0_12px_36px_rgba(24,39,75,0.06)] ring-1 ring-black/5">
          <h2 className="text-[30px] font-black tracking-[-0.05em] text-[#111827]">Offre momentanement fermee</h2>
          <p className="mx-auto mt-3 max-w-[720px] text-[15px] leading-7 text-[#667085]">
            L&apos;administration n&apos;a pas encore active cette page ou aucun produit n&apos;est relie a l&apos;offre.
          </p>
        </section>
      ) : null}

      <section>
        <div className="mb-4 text-center">
          <h2 className="text-[34px] font-black tracking-[-0.06em] text-[#111827] sm:text-[48px]">Offres du jour</h2>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {products.map((product) => {
          const isSelected = selectedSlugs.includes(product.slug);
          const isDisabled = !isSelectable || (selectedSlugs.length >= config.itemLimit && !isSelected);

          return (
            <article
              key={product.slug}
              className={[
                "overflow-hidden rounded-[18px] bg-white shadow-[0_8px_22px_rgba(17,24,39,0.08)] ring-1 transition sm:rounded-[20px]",
                isSelected ? "ring-[#ff4f2a]" : "ring-black/5",
                isDisabled ? "opacity-80" : "hover:-translate-y-1 hover:shadow-[0_18px_38px_rgba(17,24,39,0.12)]",
              ].join(" ")}
            >
              <div className="relative aspect-square bg-[#f6f7fb]">
                <Image
                  src={product.image}
                  alt={product.title}
                  fill
                  sizes="(min-width: 1280px) 15vw, (min-width: 1024px) 22vw, (min-width: 640px) 30vw, 48vw"
                  className="object-cover"
                />
                <div className="absolute left-0 right-0 top-0 flex items-center justify-between bg-[#1fc76a] px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-white sm:px-3 sm:py-2 sm:text-[11px] sm:tracking-[0.14em]">
                  <span>ALL</span>
                  <span>{product.badgeText}</span>
                </div>
                <button
                  type="button"
                  onClick={() => toggleSelection(product.slug)}
                  disabled={isDisabled}
                  className={[
                    "absolute bottom-2 right-2 inline-flex h-10 w-10 items-center justify-center rounded-full border text-white shadow-[0_14px_28px_rgba(17,24,39,0.18)] transition sm:bottom-3 sm:right-3 sm:h-12 sm:w-12",
                    isSelected ? "border-[#111827] bg-[#111827]" : "border-white bg-[#ff4f2a]",
                    isDisabled ? "cursor-not-allowed opacity-70" : "hover:scale-105",
                  ].join(" ")}
                  aria-label={isSelected ? "Retirer cet article" : "Selectionner cet article"}
                >
                  {isSelected ? <Check className="h-4 w-4 sm:h-5 sm:w-5" /> : <Gift className="h-4 w-4 sm:h-5 sm:w-5" />}
                </button>
              </div>
              <div className="space-y-2 px-3 py-3 sm:space-y-3 sm:px-4 sm:py-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#15b86c] sm:text-[11px] sm:tracking-[0.14em]">Campagne acquisition</div>
                  <div className="rounded-full bg-[#fff1f5] px-2 py-1 text-[9px] font-bold text-[#ff275f] sm:text-[10px]">{product.tagText}</div>
                </div>
                <h2 className="line-clamp-2 min-h-[38px] text-[13px] font-black leading-5 tracking-[-0.03em] text-[#111827] sm:min-h-[48px] sm:text-[17px] sm:leading-6">
                  {product.title}
                </h2>
                <div className="line-clamp-1 text-[11px] text-[#667085] sm:text-[13px]">{product.supplierName}</div>
                <div className="flex items-end gap-2">
                  <div className="text-[19px] font-black tracking-[-0.05em] text-[#ff4f2a] sm:text-[26px]">{product.freeLabel}</div>
                  <div className="pb-0.5 text-[11px] font-semibold text-[#98a2b3] line-through sm:pb-1 sm:text-[15px]">{product.compareAtLabel}</div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <Link href={product.href} prefetch={false} className="text-[11px] font-semibold text-[#111827] transition hover:text-[#ff4f2a] sm:text-[13px]">
                    Voir le produit
                  </Link>
                  <div className="text-[10px] font-semibold text-[#ff4f2a] sm:text-[12px]">
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
        <aside className="overflow-hidden rounded-[30px] bg-white px-5 py-5 shadow-[0_10px_32px_rgba(17,24,39,0.08)] ring-1 ring-black/5 sm:px-6 sm:py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-[#fff3ea] text-[#ff4f2a]">
              <Gift className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#ff4f2a]">Votre lot</div>
              <div className="mt-1 text-[22px] font-black tracking-[-0.04em] text-[#111827]">
                {selectedSlugs.length}/{totalCartSlots} article(s)
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
                : "Cette offre n'est pas disponible pour le moment."}
            </div>
          </div>

          {hasStandardCartConflict ? (
            <div className="mt-4 rounded-[20px] border border-[#ffd7c2] bg-[#fff7f1] px-4 py-4">
              <div className="text-[15px] font-black tracking-[-0.03em] text-[#111827]">Videz votre panier standard</div>
              <p className="mt-1 text-[13px] leading-6 text-[#7a4b28]">
                Cette offre utilise un panier dedie. Les articles gratuits ne peuvent pas se melanger avec des articles ordinaires.
              </p>
              <button
                type="button"
                onClick={clearStandardCart}
                className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#111827] px-5 text-[14px] font-semibold text-white transition hover:bg-black sm:w-auto"
              >
                <Trash2 className="h-4 w-4" />
                Vider votre panier
              </button>
            </div>
          ) : null}

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

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={clearFreeDealCart}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-[#d0d5dd] px-5 text-[14px] font-semibold text-[#111827] transition hover:border-[#ff4f2a] hover:text-[#ff4f2a] sm:w-auto"
            >
              <Trash2 className="h-4 w-4" />
              Vider le panier gratuit
            </button>
            {access.shareUrl ? (
              <button
                type="button"
                onClick={copyShareLink}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-[#ffd1bf] bg-[#fff4ed] px-5 text-[14px] font-semibold text-[#ff4f2a] transition hover:bg-[#ffeadd] sm:w-auto"
              >
                <Copy className="h-4 w-4" />
                Copier le lien
              </button>
            ) : null}
          </div>
        </aside>

        <section id="free-deal-checkout" className="overflow-hidden rounded-[30px] bg-white px-5 py-5 shadow-[0_10px_32px_rgba(17,24,39,0.08)] ring-1 ring-black/5 sm:px-6 sm:py-6">
          <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#ff4f2a]">Paiement</div>
          <h2 className="mt-2 text-[28px] font-black tracking-[-0.05em] text-[#111827]">Panier gratuit dedie</h2>
          <p className="mt-2 max-w-[760px] text-[14px] leading-7 text-[#667085]">
            Quand les {config.itemLimit} articles sont dans le panier gratuit, vous validez l&apos;adresse puis vous reglez directement {config.fixedPriceLabel}.
          </p>

          {feedback ? <div className="mt-5 rounded-[18px] border border-[#fed7d7] bg-[#fff1f2] px-4 py-4 text-[14px] font-medium text-[#b42318]">{feedback}</div> : null}
          {access.status === "blocked" ? <div className="mt-5 rounded-[18px] border border-[#f4d8c2] bg-[#fff7f1] px-4 py-4 text-[14px] font-medium text-[#8a4b16]">Cette offre n&apos;est plus disponible sur cet appareil.</div> : null}

          <div className="mt-6 rounded-[22px] bg-[#f8fafc] px-4 py-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#667085]">Adresse de livraison</div>
                <div className="mt-2 text-[20px] font-black tracking-[-0.04em] text-[#111827]">
                  {hasAddressDetails ? formState.customerName : "A renseigner"}
                </div>
                <div className="mt-1 break-words text-[14px] leading-6 text-[#667085]">
                  {hasAddressDetails ? `${addressSummary}${formState.customerPhone ? ` · ${formState.customerPhone}` : ""}` : "Ajoutez votre adresse pour finaliser le lot gratuit."}
                </div>
                {initialCustomer.hasDefaultAddress && hasAddressDetails ? (
                  <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-[#ecfdf3] px-3 py-1 text-[12px] font-semibold text-[#117a37]">
                    <MapPin className="h-3.5 w-3.5" />
                    Adresse par defaut detectee
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={showAddressForm ? closeAddressForm : openAddressForm}
                className="inline-flex h-11 w-full shrink-0 items-center justify-center rounded-full border border-[#d0d5dd] px-5 text-[14px] font-semibold text-[#111827] transition hover:border-[#ff4f2a] hover:text-[#ff4f2a] sm:w-auto"
              >
                {showAddressForm ? "Fermer" : hasAddressDetails ? "Modifier l'adresse" : "Ajouter l'adresse"}
              </button>
            </div>
          </div>

          {showAddressForm ? (
            <div id="free-deal-address" className="mt-6 grid gap-4 md:grid-cols-2">
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
          ) : null}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 text-[14px] text-[#667085]">
              {hasStandardCartConflict
                ? "Videz d'abord votre panier standard."
                : isSelectionComplete
                  ? `Lot complet: ${config.fixedPriceLabel}`
                  : `Selection incomplete: ${selectedSlugs.length}/${config.itemLimit}`}
            </div>
            <button
              type="button"
              onClick={() => {
                if (!showAddressForm && !hasAddressDetails && isSelectionComplete) {
                  openAddressForm();
                  return;
                }

                void submitCheckout();
              }}
              disabled={!canSubmit || isSubmitting || hasStandardCartConflict}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#111827] px-6 text-[15px] font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
              {isSubmitting ? "Preparation..." : config.ctaLabel}
            </button>
          </div>
        </section>
      </section>

      <div className="fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom))] z-[120] border-t border-black/10 bg-white/96 px-4 py-3 backdrop-blur md:hidden">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#98a2b3]">Lot gratuit</div>
            <div className="truncate text-[18px] font-black tracking-[-0.04em] text-[#111827]">{selectedSlugs.length}/{config.itemLimit} · {config.fixedPriceLabel}</div>
            <div className="truncate text-[12px] text-[#667085]">
              {hasStandardCartConflict ? "Vider votre panier standard" : !isSelectable ? "Offre indisponible" : isSelectionComplete ? "Adresse puis paiement" : `Encore ${remainingSelectionCount} article(s)`}
            </div>
          </div>
          <button
            type="button"
            onClick={handleMobileCta}
            disabled={isSubmitting}
            className="inline-flex h-[52px] min-w-[132px] items-center justify-center rounded-full bg-[#111827] px-4 text-[14px] font-semibold text-white shadow-[0_14px_28px_rgba(17,24,39,0.18)] transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Preparation..." : mobileCtaLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
