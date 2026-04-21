"use client";

import Image from "next/image";
import Link from "next/link";
import { Check, Copy, Gift, LoaderCircle, LocateFixed, MapPin, ShoppingCart, Sparkles, Trash2, Truck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useCart } from "@/components/cart-provider";
import { buildApiUrl, buildLocalUrl } from "@/lib/api";
import { canonicalizeCountryCode, resolveGeocodedCountryCode } from "@/lib/country-utils";
import { DELIVERY_COUNTRY_OPTIONS, type CountryCode } from "@/lib/pricing-options";

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
  alreadyPurchased: boolean;
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
    shippingFromLabel: string;
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

type ManyChatCheckoutContext = {
  manychatSubscriberId?: string;
  manychatFlowId?: string;
  manychatPaidTagId?: string;
};

type ReverseGeocodeResponse = {
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  countryCode?: string;
  countryLabel?: string;
  displayName?: string;
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
const FREE_DEAL_LOCATION_COUNTRIES: CountryCode[] = ["TG", "CI", "BJ", "BF", "GH"];

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
  const [manychatContext, setManychatContext] = useState<ManyChatCheckoutContext>({});
  const [isLocating, setIsLocating] = useState(false);
  const [locationFeedback, setLocationFeedback] = useState<string | null>(null);

  const isSelectable = access.status === "eligible" || access.status === "unlocked";
  const purchasedSlugSet = useMemo(
    () => new Set(products.filter((product) => product.alreadyPurchased).map((product) => product.slug)),
    [products],
  );
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

    const params = new URLSearchParams(window.location.search);
    const subscriberId = params.get("manychatSubscriberId")
      || params.get("subscriberId")
      || params.get("subscriber_id")
      || params.get("mcsid");
    const flowId = params.get("manychatFlowId") || params.get("flowId") || params.get("flow_id");
    const paidTagId = params.get("manychatPaidTagId") || params.get("paidTagId") || params.get("paid_tag_id");

    setManychatContext({
      manychatSubscriberId: subscriberId?.trim() || undefined,
      manychatFlowId: flowId?.trim() || undefined,
      manychatPaidTagId: paidTagId?.trim() || undefined,
    });
  }, []);

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
        .filter((slug) => !purchasedSlugSet.has(slug))
        .slice(0, config.itemLimit);
      setSelectedSlugs(nextSelection);
    } catch {
      window.localStorage.removeItem(FREE_DEAL_CART_STORAGE_KEY);
    }
  }, [config.itemLimit, products, purchasedSlugSet]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(FREE_DEAL_CART_STORAGE_KEY, JSON.stringify(selectedSlugs));
  }, [selectedSlugs]);

  const totalCartSlots = config.itemLimit;
  const selectedCountryCode = canonicalizeCountryCode(formState.countryCode, initialCustomer.countryCode || "TG") as CountryCode;
  const canUseCurrentPosition = FREE_DEAL_LOCATION_COUNTRIES.includes(selectedCountryCode);
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
    if (!isSelectable || isSubmitting || hasStandardCartConflict || purchasedSlugSet.has(slug)) {
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
    if (key === "countryCode") {
      setLocationFeedback(null);
    }

    setFormState((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const hydrateAddressFromCoordinates = async (latitude: number, longitude: number) => {
    const response = await fetch(buildLocalUrl("/api/location/reverse-geocode"), {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ latitude, longitude }),
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload) {
      throw new Error(payload?.message || "Impossible de remplir l'adresse depuis cette position.");
    }

    const geocoded = payload as ReverseGeocodeResponse;
    const normalizedCountryCode = resolveGeocodedCountryCode({
      countryCode: geocoded.countryCode,
      countryLabel: geocoded.countryLabel,
      displayName: geocoded.displayName,
      city: geocoded.city,
      state: geocoded.state,
      addressLine1: geocoded.addressLine1,
      coordinates: { latitude, longitude },
      fallbackCountryCode: selectedCountryCode,
    }) as CountryCode;

    if (!FREE_DEAL_LOCATION_COUNTRIES.includes(normalizedCountryCode)) {
      throw new Error("La position actuelle n'est prise en charge que pour le Togo, la Côte d'Ivoire, le Bénin, le Burkina Faso et le Ghana.");
    }

    setFormState((current) => ({
      ...current,
      addressLine1: geocoded.addressLine1 || geocoded.displayName || current.addressLine1,
      addressLine2: geocoded.addressLine2 || current.addressLine2,
      city: geocoded.city || current.city,
      state: geocoded.state || geocoded.city || current.state,
      postalCode: geocoded.postalCode || current.postalCode,
      countryCode: normalizedCountryCode,
    }));

    setLocationFeedback(`Adresse detectee: ${geocoded.displayName || [geocoded.city, geocoded.countryLabel].filter(Boolean).join(", ")}`);
  };

  const handleUseCurrentPosition = () => {
    if (!canUseCurrentPosition) {
      setLocationFeedback("La position actuelle est disponible pour le Togo, la Côte d'Ivoire, le Bénin, le Burkina Faso et le Ghana.");
      return;
    }

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationFeedback("La geolocalisation n'est pas disponible sur cet appareil.");
      return;
    }

    setIsLocating(true);
    setLocationFeedback(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        void hydrateAddressFromCoordinates(position.coords.latitude, position.coords.longitude)
          .catch((error) => {
            setLocationFeedback(error instanceof Error ? error.message : "Impossible d'utiliser votre position actuelle.");
          })
          .finally(() => {
            setIsLocating(false);
          });
      },
      () => {
        setIsLocating(false);
        setLocationFeedback("Impossible d'acceder a votre position exacte.");
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
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
          ...manychatContext,
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
        credentials: "include",
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
  const showcaseProducts = products.slice(0, 12);

  return (
    <div className="space-y-6 pb-[calc(11rem+env(safe-area-inset-bottom))] md:pb-0">
      <section className="relative -mx-4 overflow-hidden bg-[#f4f5f7] sm:-mx-6 lg:left-1/2 lg:right-1/2 lg:-mx-[50vw] lg:w-screen">
        <div className="relative overflow-hidden bg-[linear-gradient(90deg,#ef2026_0%,#ff1b1f_68%,#ef2026_100%)] text-white shadow-[0_24px_60px_rgba(239,32,38,0.18)]">
          <div className="pointer-events-none absolute -right-10 top-0 h-full w-[240px] bg-[linear-gradient(135deg,transparent_0%,transparent_38%,rgba(178,0,14,0.55)_38%,rgba(178,0,14,0.55)_62%,transparent_62%)]" />
          <div className="px-4 py-4 sm:px-6 lg:px-10">
            <div className="flex flex-wrap items-center gap-3 sm:gap-5">
              <div className="rounded-full bg-[#ff9800] p-2 text-white shadow-[0_8px_20px_rgba(0,0,0,0.18)]">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="text-[28px] font-black tracking-[-0.06em] sm:text-[40px]">Daily Time</div>
              <div className="text-[13px] font-semibold text-white/95 sm:text-[16px]">Offres limitées</div>
              <div className="text-[13px] font-semibold text-white/95 sm:text-[16px]">Jusqu&apos;a {config.dealTagText}</div>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-[1680px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mb-5 text-center sm:mb-7">
            <h1 className="text-[28px] font-black tracking-[-0.06em] text-[#111827] sm:text-[54px]">Offres du jour</h1>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 xl:gap-5">
            {showcaseProducts.map((product) => {
              const isSelected = selectedSlugs.includes(product.slug);
              const isDisabled = product.alreadyPurchased || !isSelectable || (selectedSlugs.length >= config.itemLimit && !isSelected);

              return (
                <article
                  key={product.slug}
                  className={[
                    "overflow-hidden rounded-[14px] bg-white shadow-[0_8px_22px_rgba(17,24,39,0.06)] ring-1 transition",
                    isSelected ? "ring-[#ff3b30]" : "ring-black/5",
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
                    <div className="absolute left-0 right-0 top-0 grid grid-cols-[1fr_auto] bg-[#30c96b] text-white">
                      <div className="flex items-center justify-center gap-1 border-r border-white/15 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] sm:text-[10px]">
                        <Check className="h-3.5 w-3.5" />
                        ALL
                      </div>
                      <div className="px-3 py-1 text-[9px] font-bold sm:text-[10px]">Free</div>
                    </div>
                    {product.tagText ? (
                      <div className="absolute bottom-2 left-0 rounded-r-full bg-[#ef2026] px-2.5 py-1 text-[9px] font-bold text-white shadow-[0_10px_20px_rgba(239,32,38,0.28)] sm:bottom-3 sm:text-[10px]">
                        {product.tagText}
                      </div>
                    ) : null}
                    {!product.alreadyPurchased ? (
                      <div className="absolute left-2 top-9 rounded-[6px] bg-[#ffe27a] px-1.5 py-0.5 text-[9px] font-bold text-[#3d2b00] shadow-[0_8px_18px_rgba(0,0,0,0.12)] sm:top-10 sm:text-[10px]">
                        Choice
                      </div>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => toggleSelection(product.slug)}
                      disabled={isDisabled}
                      className={[
                        "absolute bottom-2 right-2 inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#ececec] bg-white text-[#111827] shadow-[0_10px_22px_rgba(17,24,39,0.14)] transition sm:h-12 sm:w-12",
                        isSelected ? "ring-2 ring-[#ff3b30]" : "",
                        isDisabled ? "cursor-not-allowed opacity-70" : "hover:scale-105",
                      ].join(" ")}
                      aria-label={isSelected ? "Retirer cet article" : "Selectionner cet article"}
                    >
                      {isSelected ? <Check className="h-4 w-4 sm:h-5 sm:w-5" /> : <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5" />}
                    </button>
                  </div>
                  <div className="px-2.5 pb-3 pt-2.5 sm:px-3 sm:pb-4">
                    <div className="line-clamp-2 min-h-[42px] text-[12px] font-medium leading-5 tracking-[-0.03em] text-[#202124] sm:min-h-[52px] sm:text-[14px]">
                      {product.title}
                    </div>
                    <div className="mt-1 text-[11px] font-semibold text-[#ff3b30] sm:text-[12px]">
                      {product.alreadyPurchased ? "Deja achete" : isSelected ? "Ajoute au lot" : product.tagText}
                    </div>
                    <div className="mt-1 text-[12px] text-[#667085] sm:text-[13px]">{product.supplierName}</div>
                    <div className="mt-1 inline-flex max-w-full items-center gap-1 text-[10px] text-[#159a55] sm:text-[11px]">
                      <Truck className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">Livraison gratuite dès {config.shippingFromLabel}</span>
                    </div>
                    <div className="mt-2 flex items-end gap-2">
                      <div className="text-[22px] font-black tracking-[-0.05em] text-[#111827] sm:text-[24px]">{product.freeLabel}</div>
                      <div className="pb-1 text-[11px] text-[#9aa1ad] line-through sm:text-[13px]">{product.compareAtLabel}</div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-[24px] bg-white px-4 py-4 shadow-[0_10px_26px_rgba(17,24,39,0.08)] ring-1 ring-black/5 sm:px-5">
              <div className="flex flex-wrap items-center gap-3">
                {promoCoupons.map((coupon) => (
                  <div key={coupon.id} className="flex min-w-[220px] flex-1 items-center justify-between gap-3 rounded-[18px] bg-[#fff6f1] px-4 py-3">
                    <div>
                      <div className="text-[18px] font-black tracking-[-0.04em] text-[#ef2026]">{coupon.value}</div>
                      <div className="text-[12px] text-[#6b7280]">{coupon.label}</div>
                    </div>
                    <button
                      type="button"
                      onClick={copyShareLink}
                      className="inline-flex h-10 items-center justify-center rounded-full bg-[#ef2026] px-4 text-[12px] font-semibold text-white transition hover:bg-[#d8151b]"
                    >
                      Copie
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-[18px] bg-[#111827] px-4 py-4 text-white">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">Statut rapide</div>
                <div className="mt-2 text-[18px] font-black tracking-[-0.04em]">{statusMessage}</div>
                {shareFeedback ? <div className="mt-2 text-[12px] text-white/80">{shareFeedback}</div> : null}
              </div>
            </div>

            <div className="rounded-[24px] bg-white px-4 py-4 shadow-[0_10px_26px_rgba(17,24,39,0.08)] ring-1 ring-black/5 sm:px-5">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[#fff1eb] text-[#ef2026]">
                  <Gift className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#ef2026]">Lot gratuit</div>
                  <div className="mt-1 text-[24px] font-black tracking-[-0.05em] text-[#111827]">{selectedSlugs.length}/{config.itemLimit}</div>
                  <div className="mt-1 text-[13px] leading-6 text-[#667085]">{config.fixedPriceLabel} pour valider le lot et lancer la livraison.</div>
                </div>
              </div>
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
          const isDisabled = product.alreadyPurchased || !isSelectable || (selectedSlugs.length >= config.itemLimit && !isSelected);

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
                  <div className="rounded-full bg-[#fff1f5] px-2 py-1 text-[9px] font-bold text-[#ff275f] sm:text-[10px]">{product.alreadyPurchased ? "Deja achete" : product.tagText}</div>
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
                    {product.alreadyPurchased ? "Deja achete" : isSelected ? "Selectionne" : "Choisir"}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
        </div>
        {products.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-[#d0d5dd] bg-white px-6 py-10 text-center shadow-[0_10px_28px_rgba(17,24,39,0.05)]">
            <div className="text-[22px] font-black tracking-[-0.04em] text-[#111827]">Aucun article gratuit disponible pour le moment</div>
            <div className="mx-auto mt-3 max-w-[640px] text-[14px] leading-7 text-[#667085]">
              Les produits de la campagne ne sont pas encore relies au catalogue public ou sont en cours de synchronisation.
            </div>
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <aside className="overflow-hidden rounded-[24px] bg-white px-4 py-4 shadow-[0_10px_28px_rgba(17,24,39,0.08)] ring-1 ring-black/5 sm:px-5 sm:py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[#fff3ea] text-[#ff4f2a]">
              <Gift className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#ff4f2a]">Votre lot</div>
              <div className="mt-0.5 text-[20px] font-black tracking-[-0.04em] text-[#111827]">
                {selectedSlugs.length}/{totalCartSlots} article(s)
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-[18px] bg-[#f8fafc] px-4 py-3.5">
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#667085]">Montant unique</div>
            <div className="mt-1.5 text-[28px] font-black tracking-[-0.05em] text-[#111827]">{config.fixedPriceLabel}</div>
            <div className="mt-1 text-[12px] leading-5 text-[#667085]">
              {isSelectable
                ? isSelectionComplete
                  ? "Votre lot est complet. Vous pouvez lancer le paiement."
                  : `Ajoutez encore ${remainingSelectionCount} article(s) pour continuer.`
                : "Cette offre n'est pas disponible pour le moment."}
            </div>
          </div>

          {hasStandardCartConflict ? (
            <div className="mt-4 rounded-[18px] border border-[#ffd7c2] bg-[#fff7f1] px-4 py-3.5">
              <div className="text-[14px] font-black tracking-[-0.03em] text-[#111827]">Videz votre panier standard</div>
              <p className="mt-1 text-[12px] leading-5 text-[#7a4b28]">
                Cette offre utilise un panier dedie. Les articles gratuits ne peuvent pas se melanger avec des articles ordinaires.
              </p>
              <button
                type="button"
                onClick={clearStandardCart}
                className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-[#111827] px-5 text-[13px] font-semibold text-white transition hover:bg-black sm:w-auto"
              >
                <Trash2 className="h-4 w-4" />
                Vider votre panier
              </button>
            </div>
          ) : null}

          <div className="mt-4 space-y-2.5">
            {selectedProducts.length > 0 ? selectedProducts.map((product, index) => (
              <div key={product.slug} className="flex items-center gap-3 rounded-[16px] bg-[#f8fafc] px-3 py-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#111827] text-[11px] font-bold text-white">
                  {index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold text-[#111827]">{product.title}</div>
                  <div className="text-[11px] text-[#667085]">Ancien prix {product.compareAtLabel}</div>
                </div>
              </div>
            )) : (
              <div className="rounded-[16px] border border-dashed border-[#d0d5dd] px-4 py-4 text-[13px] text-[#667085]">
                Aucune selection pour le moment.
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={clearFreeDealCart}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full border border-[#d0d5dd] px-5 text-[13px] font-semibold text-[#111827] transition hover:border-[#ff4f2a] hover:text-[#ff4f2a] sm:w-auto"
            >
              <Trash2 className="h-4 w-4" />
              Vider le panier gratuit
            </button>
            {access.shareUrl ? (
              <button
                type="button"
                onClick={copyShareLink}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full border border-[#ffd1bf] bg-[#fff4ed] px-5 text-[13px] font-semibold text-[#ff4f2a] transition hover:bg-[#ffeadd] sm:w-auto"
              >
                <Copy className="h-4 w-4" />
                Copier le lien
              </button>
            ) : null}
          </div>
        </aside>

        <section id="free-deal-checkout" className="overflow-hidden rounded-[24px] bg-white px-4 py-4 shadow-[0_10px_28px_rgba(17,24,39,0.08)] ring-1 ring-black/5 sm:px-5 sm:py-5">
          <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#ff4f2a]">Paiement</div>
          <h2 className="mt-1.5 text-[24px] font-black tracking-[-0.05em] text-[#111827]">Panier gratuit dedie</h2>
          <p className="mt-1.5 max-w-[760px] text-[13px] leading-6 text-[#667085]">
            Quand les {config.itemLimit} articles sont dans le panier gratuit, vous validez l&apos;adresse puis vous reglez directement {config.fixedPriceLabel}.
          </p>

          {feedback ? <div className="mt-5 rounded-[18px] border border-[#fed7d7] bg-[#fff1f2] px-4 py-4 text-[14px] font-medium text-[#b42318]">{feedback}</div> : null}
          {access.status === "blocked" ? <div className="mt-5 rounded-[18px] border border-[#f4d8c2] bg-[#fff7f1] px-4 py-4 text-[14px] font-medium text-[#8a4b16]">Cette offre n&apos;est plus disponible sur cet appareil.</div> : null}

          <div className="mt-5 rounded-[18px] bg-[#f8fafc] px-4 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#667085]">Adresse de livraison</div>
                <div className="mt-1.5 text-[18px] font-black tracking-[-0.04em] text-[#111827]">
                  {hasAddressDetails ? formState.customerName : "A renseigner"}
                </div>
                <div className="mt-1 break-words text-[13px] leading-5 text-[#667085]">
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
                className="inline-flex h-10 w-full shrink-0 items-center justify-center rounded-full border border-[#d0d5dd] px-5 text-[13px] font-semibold text-[#111827] transition hover:border-[#ff4f2a] hover:text-[#ff4f2a] sm:w-auto"
              >
                {showAddressForm ? "Fermer" : hasAddressDetails ? "Modifier l'adresse" : "Ajouter l'adresse"}
              </button>
            </div>
          </div>

          {showAddressForm ? (
            <div id="free-deal-address" className="mt-5 grid gap-3 md:grid-cols-2">
              {[
                { key: "customerName", label: "Nom complet", placeholder: "Ex: Awa Traore" },
                { key: "customerEmail", label: "Email", placeholder: "client@email.com" },
                { key: "customerPhone", label: "Telephone", placeholder: "+228 ..." },
                { key: "city", label: "Ville", placeholder: "Lome" },
                { key: "state", label: "Region / Etat", placeholder: "Maritime" },
                { key: "addressLine1", label: "Adresse", placeholder: "Rue, quartier, repere" },
                { key: "addressLine2", label: "Complement", placeholder: "Batiment, etage..." },
                { key: "postalCode", label: "Code postal", placeholder: "75001" },
              ].map((field) => (
                <label key={field.key} className={field.key === "addressLine1" ? "space-y-1.5 text-[12px] font-semibold text-[#344054] md:col-span-2" : "space-y-1.5 text-[12px] font-semibold text-[#344054]"}>
                  <span>{field.label}</span>
                  <input
                    value={formState[field.key as keyof CustomerFormState]}
                    onChange={(event) => handleFieldChange(field.key as keyof CustomerFormState, event.target.value)}
                    placeholder={field.placeholder}
                    className="h-11 w-full rounded-[14px] border border-[#d0d5dd] bg-white px-4 text-[13px] text-[#111827] outline-none transition focus:border-[#ff4f2a]"
                  />
                </label>
              ))}

              <label className="space-y-1.5 text-[12px] font-semibold text-[#344054]">
                <span>Pays</span>
                <select
                  value={selectedCountryCode}
                  onChange={(event) => handleFieldChange("countryCode", event.target.value)}
                  className="h-11 w-full rounded-[14px] border border-[#d0d5dd] bg-white px-4 text-[13px] text-[#111827] outline-none transition focus:border-[#ff4f2a]"
                >
                  {DELIVERY_COUNTRY_OPTIONS.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.flagEmoji} {country.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="space-y-2 rounded-[16px] border border-[#e4e7ec] bg-[#f8fafc] px-4 py-3 md:col-span-2">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-[13px] font-semibold text-[#111827]">Position actuelle</div>
                    <div className="text-[12px] leading-5 text-[#667085]">
                      Disponible pour Togo, Côte d'Ivoire, Bénin, Burkina Faso et Ghana.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleUseCurrentPosition}
                    disabled={isLocating || !canUseCurrentPosition}
                    className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full border border-[#ffd1bf] bg-[#fff4ed] px-4 text-[13px] font-semibold text-[#ff4f2a] transition hover:bg-[#ffeadd] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                  >
                    {isLocating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
                    {isLocating ? "Localisation..." : "Ma position actuelle"}
                  </button>
                </div>
                {locationFeedback ? <div className="text-[12px] text-[#475467]">{locationFeedback}</div> : null}
              </div>
            </div>
          ) : null}

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 text-[13px] text-[#667085]">
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
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#111827] px-6 text-[14px] font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
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
