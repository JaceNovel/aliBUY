"use client";

import Image from "next/image";
import Link from "next/link";
import { BadgeHelp, CheckCircle2, Circle, Heart, LockKeyhole, MapPin, Minus, Package, Plus, Share2, ShieldCheck, ShoppingCart, Sparkles, Star, TicketPercent, Trash2, Truck } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useCart, useCartQuote } from "@/components/cart-provider";
import { buildCartItemKey, formatSourcingAmount, resolveSourcingDeliveryPlan } from "@/lib/alibaba-sourcing";

type SharedCartSummary = {
  id: string;
  token: string;
  ownerDisplayName: string;
  status: "active" | "claimed" | "ordered" | "expired";
  claimCount: number;
  claimedByDisplayName?: string;
  claimedOrderId?: string;
  updatedAt: string;
};

type PaymentSecurityBadgeKey = "visa" | "mastercard" | "mobile-money" | "moneroo";

function PaymentSecurityBadge({ brand }: { brand: PaymentSecurityBadgeKey }) {
  if (brand === "visa") {
    return (
      <div className="flex h-14 items-center justify-center rounded-[14px] border border-[#d7e3ff] bg-white px-4 shadow-[0_8px_22px_rgba(17,24,39,0.04)]">
        <span className="text-[18px] font-black italic tracking-[-0.08em] text-[#1a4fd7]">VISA</span>
      </div>
    );
  }

  if (brand === "mastercard") {
    return (
      <div className="flex h-14 items-center justify-center gap-3 rounded-[14px] border border-[#ffe4dd] bg-white px-4 shadow-[0_8px_22px_rgba(17,24,39,0.04)]">
        <div className="relative h-6 w-10">
          <span className="absolute left-0 top-0 h-6 w-6 rounded-full bg-[#eb001b]" />
          <span className="absolute right-0 top-0 h-6 w-6 rounded-full bg-[#f79e1b]" />
        </div>
        <span className="text-[12px] font-bold tracking-[-0.02em] text-[#1f2937]">mastercard</span>
      </div>
    );
  }

  if (brand === "mobile-money") {
    return (
      <div className="flex h-14 items-center justify-center gap-2 rounded-[14px] border border-[#d6f5df] bg-white px-4 shadow-[0_8px_22px_rgba(17,24,39,0.04)]">
        <div className="relative h-7 w-5 rounded-[6px] border-2 border-[#16a34a]">
          <span className="absolute inset-x-1.5 bottom-1 h-0.5 rounded-full bg-[#16a34a]" />
        </div>
        <span className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#15803d]">Mobile Money</span>
      </div>
    );
  }

  return (
    <div className="flex h-14 items-center justify-center gap-2 rounded-[14px] border border-[#d9def7] bg-[linear-gradient(135deg,#111827_0%,#324156_100%)] px-4 shadow-[0_8px_22px_rgba(17,24,39,0.08)]">
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-[11px] font-black text-[#111827]">M</div>
      <span className="text-[12px] font-extrabold uppercase tracking-[0.08em] text-white">Moneroo</span>
    </div>
  );
}

export function CartPageClient({ currencyCode, locale, initialCountryCode, isAuthenticated, initialSharedCartSummaries }: { currencyCode: string; locale: string; initialCountryCode: string; isAuthenticated: boolean; initialSharedCartSummaries: SharedCartSummary[] }) {
  const router = useRouter();
  const { items, updateItem, removeItem, clearCart, sharedCartContext } = useCart();
  const deliveryInfoRef = useRef<HTMLElement | null>(null);
  const cartKeys = useMemo(() => items.map((item) => buildCartItemKey(item.slug, item.selectedVariants)), [items]);
  const deliveryPlan = useMemo(() => resolveSourcingDeliveryPlan({
    countryCode: initialCountryCode,
    deliveryProfile: { mode: "direct" },
  }), [initialCountryCode]);
  const { quote, isLoading } = useCartQuote({
    disableFreeAir: !deliveryPlan.workflow.freeDeliveryEligible,
    deliveryMode: "direct",
  });
  const [shareMessage, setShareMessage] = useState("");
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [sharePulse, setSharePulse] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [favoriteSlugs, setFavoriteSlugs] = useState<string[]>([]);
  const [favoriteBusySlug, setFavoriteBusySlug] = useState<string | null>(null);
  const [selectedCartKeys, setSelectedCartKeys] = useState<string[]>([]);
  const [selectionPulse, setSelectionPulse] = useState(false);
  const shipping = useMemo(() => quote.shippingOptions.find((option) => option.key === quote.recommendedMethod) ?? quote.shippingOptions[0], [quote.recommendedMethod, quote.shippingOptions]);
  const totalFcfa = quote.cartProductsTotalFcfa + (shipping?.priceFcfa ?? 0);
  const totalWeightLabel = quote.totalWeightKg > 0 ? `${quote.totalWeightKg.toFixed(2)} kg` : "Selon catalogue";
  const totalVolumeLabel = quote.totalCbm > 0 ? `${quote.totalCbm.toFixed(4)} CBM` : "Selon catalogue";
  const roundPromoAmount = (amount: number) => {
    if (amount >= 10000) {
      return Math.round(amount / 100) * 100;
    }
    if (amount >= 1000) {
      return Math.round(amount / 50) * 50;
    }
    return Math.round(amount / 10) * 10;
  };
  const originalTotalFcfa = roundPromoAmount(totalFcfa * 1.14);
  const welcomeDiscountFcfa = Math.max(500, originalTotalFcfa - totalFcfa);
  const welcomeCouponThresholdFcfa = roundPromoAmount(Math.max(totalFcfa * 0.2, 5000));
  const welcomeCouponDiscountFcfa = Math.min(welcomeDiscountFcfa, roundPromoAmount(Math.max(totalFcfa * 0.04, 500)));
  const securePaymentBonusFcfa = roundPromoAmount(Math.max(totalFcfa * 0.06, 750));
  const promoRows = useMemo(() => ([
    {
      id: "welcome",
      icon: TicketPercent,
      label: `${formatSourcingAmount(welcomeCouponDiscountFcfa, { currencyCode, locale })} sur ${formatSourcingAmount(welcomeCouponThresholdFcfa, { currencyCode, locale })}`,
      accent: "bg-[#fff2f3] text-[#f80632]",
    },
    {
      id: "paypal",
      icon: Sparkles,
      label: `${formatSourcingAmount(securePaymentBonusFcfa, { currencyCode, locale })} suppl. avec paiement sécurisé`,
      accent: "bg-[#eef6ff] text-[#1457d8]",
    },
  ]), [currencyCode, locale, securePaymentBonusFcfa, welcomeCouponDiscountFcfa, welcomeCouponThresholdFcfa]);
  const paymentSecurityBadges: PaymentSecurityBadgeKey[] = ["visa", "mastercard", "mobile-money", "moneroo"];
  const localizedRemainingFreeShippingLabel = formatSourcingAmount(quote.freeAirRemainingFcfa, { currencyCode, locale });
  const shippingThresholdMessage = deliveryPlan.workflow.freeDeliveryEligible
    ? quote.recommendedMethod === "sea"
      ? "Le moyen de livraison peut etre changé si le poids est trop conséquent. Pour profiter de la livraison gratuite, les commandes ne doivent pas dépasser 2.5 kg."
      : shipping?.key === "air" && shipping.isFree
        ? "Livraison gratuite active pour ce devis. Pour en profiter, les commandes ne doivent pas dépasser 2.5 kg."
        : quote.freeAirRemainingFcfa > 0
          ? `Ajoutez encore ${localizedRemainingFreeShippingLabel} à votre devis pour profiter de la livraison gratuite, sous 2.5 kg.`
          : quote.freeShippingMessage
    : quote.freeShippingMessage;
  const allItemsSelected = cartKeys.length > 0 && cartKeys.every((cartKey) => selectedCartKeys.includes(cartKey));
  const selectedCount = selectedCartKeys.length;
  const selectedQuoteItems = quote.items.filter((item) => selectedCartKeys.includes(item.cartKey ?? item.slug));
  const selectedProductsTotalFcfa = selectedQuoteItems.reduce((sum, item) => sum + item.finalLinePriceFcfa, 0);
  const selectedTotalFcfa = selectedCount > 0 ? selectedProductsTotalFcfa + (shipping?.priceFcfa ?? 0) : 0;
  const selectedWeightKg = selectedQuoteItems.reduce((sum, item) => sum + item.weightKg * item.quantity, 0);

  useEffect(() => {
    setSelectedCartKeys((current) => {
      const next = current.filter((cartKey) => cartKeys.includes(cartKey));
      if (next.length === cartKeys.length) {
        return next;
      }
      if (next.length === 0) {
        return cartKeys;
      }
      return next;
    });
  }, [cartKeys]);

  useEffect(() => {
    if (!isAuthenticated) {
      setFavoriteSlugs([]);
      return;
    }

    let isCancelled = false;
    const uniqueSlugs = [...new Set(items.map((item) => item.slug))];

    if (uniqueSlugs.length === 0) {
      setFavoriteSlugs([]);
      return;
    }

    const hydrateFavorites = async () => {
      try {
        const results = await Promise.all(uniqueSlugs.map(async (slug) => {
          const response = await fetch(`/api/favorites?productSlug=${encodeURIComponent(slug)}`, {
            method: "GET",
            cache: "no-store",
          });
          const payload = await response.json().catch(() => null);
          return response.ok && payload?.isFavorite === true ? slug : null;
        }));

        if (!isCancelled) {
          setFavoriteSlugs(results.filter((value): value is string => Boolean(value)));
        }
      } catch {
        if (!isCancelled) {
          setFavoriteSlugs([]);
        }
      }
    };

    void hydrateFavorites();

    return () => {
      isCancelled = true;
    };
  }, [isAuthenticated, items]);

  const triggerShareFeedback = (message: string) => {
    setSharePulse(true);
    setShareFeedback(message);
    window.setTimeout(() => setSharePulse(false), 320);
    window.setTimeout(() => {
      setShareFeedback((current) => (current === message ? null : current));
    }, 2200);
  };

  const triggerSelectionAnimation = () => {
    setSelectionPulse(true);
    window.setTimeout(() => setSelectionPulse(false), 260);
  };

  const toggleAllItemsSelection = () => {
    setSelectedCartKeys(allItemsSelected ? [] : cartKeys);
    triggerSelectionAnimation();
  };

  const toggleCartItemSelection = (cartKey: string) => {
    setSelectedCartKeys((current) => (
      current.includes(cartKey)
        ? current.filter((entry) => entry !== cartKey)
        : [...current, cartKey]
    ));
    triggerSelectionAnimation();
  };

  const removeSelectedItems = () => {
    if (selectedCartKeys.length === 0) {
      triggerShareFeedback("Aucun article sélectionné");
      return;
    }

    selectedCartKeys.forEach((cartKey) => {
      removeItem(cartKey);
    });
    setSelectedCartKeys([]);
    triggerShareFeedback("Articles sélectionnés supprimés");
  };

  const shareCart = async () => {
    if (items.length === 0) {
      triggerShareFeedback("Panier vide");
      return;
    }

    setIsSharing(true);
    try {
      const response = await fetch("/api/cart/shares", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ items, message: shareMessage }),
      });

      if (response.status === 401) {
        router.push(`/login?next=${encodeURIComponent("/cart")}`);
        return;
      }

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.shareUrl) {
        triggerShareFeedback(typeof payload?.message === "string" ? payload.message : "Partage indisponible");
        return;
      }

      type ShareCapableNavigator = Navigator & {
        clipboard?: Clipboard;
        share?: (data?: ShareData) => Promise<void>;
      };

      const browserNavigator: ShareCapableNavigator | undefined = typeof window !== "undefined"
        ? (window.navigator as ShareCapableNavigator)
        : undefined;
      const clipboard = browserNavigator?.clipboard;

      if (browserNavigator?.share) {
        await browserNavigator.share({
          title: "Panier AfriPay partagé",
          text: payload.shareText,
          url: payload.shareUrl,
        });
        triggerShareFeedback("Panier partagé");
        return;
      }

      if (clipboard?.writeText) {
        await clipboard.writeText(payload.shareText);
        triggerShareFeedback("Message de partage copié");
        return;
      }

      triggerShareFeedback(payload.shareUrl);
    } catch {
      triggerShareFeedback("Partage annulé");
    } finally {
      setIsSharing(false);
    }
  };

  const goToFavorites = () => {
    router.push("/favorites");
  };

  const shareProduct = async (slug: string, title: string) => {
    type ShareCapableNavigator = Navigator & {
      clipboard?: Clipboard;
      share?: (data?: ShareData) => Promise<void>;
    };

    const shareUrl = typeof window !== "undefined"
      ? `${window.location.origin}/products/${encodeURIComponent(slug)}`
      : `/products/${slug}`;
    const browserNavigator: ShareCapableNavigator | undefined = typeof window !== "undefined"
      ? (window.navigator as ShareCapableNavigator)
      : undefined;

    try {
      if (browserNavigator?.share) {
        await browserNavigator.share({
          title,
          text: title,
          url: shareUrl,
        });
        triggerShareFeedback("Produit partagé");
        return;
      }

      if (browserNavigator?.clipboard?.writeText) {
        await browserNavigator.clipboard.writeText(shareUrl);
        triggerShareFeedback("Lien produit copié");
        return;
      }

      triggerShareFeedback(shareUrl);
    } catch {
      triggerShareFeedback("Partage annulé");
    }
  };

  const toggleFavorite = async (slug: string) => {
    if (favoriteBusySlug === slug) {
      return;
    }

    if (!isAuthenticated) {
      router.push(`/login?next=${encodeURIComponent("/cart")}`);
      return;
    }

    const wasFavorite = favoriteSlugs.includes(slug);
    setFavoriteBusySlug(slug);
    setFavoriteSlugs((current) => (
      wasFavorite
        ? current.filter((entry) => entry !== slug)
        : [...current, slug]
    ));

    try {
      const response = await fetch("/api/favorites", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ productSlug: slug }),
      });

      if (response.status === 401) {
        router.push(`/login?next=${encodeURIComponent("/cart")}`);
        return;
      }

      const payload = await response.json().catch(() => null);
      if (!response.ok || typeof payload?.isFavorite !== "boolean") {
        setFavoriteSlugs((current) => (
          wasFavorite
            ? [...current, slug]
            : current.filter((entry) => entry !== slug)
        ));
        triggerShareFeedback("Favori indisponible");
        return;
      }

      setFavoriteSlugs((current) => (
        payload.isFavorite
          ? current.includes(slug) ? current : [...current, slug]
          : current.filter((entry) => entry !== slug)
      ));
      triggerShareFeedback(payload.isFavorite ? "Ajouté aux favoris" : "Retiré des favoris");
    } catch {
      setFavoriteSlugs((current) => (
        wasFavorite
          ? [...current, slug]
          : current.filter((entry) => entry !== slug)
      ));
      triggerShareFeedback("Favori indisponible");
    } finally {
      setFavoriteBusySlug(null);
    }
  };

  const scrollToDeliveryInfo = () => {
    deliveryInfoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (items.length === 0) {
    return (
      <section className="rounded-[28px] border border-[#ece7df] bg-white px-5 py-10 text-center shadow-[0_16px_40px_rgba(17,24,39,0.05)] sm:px-8">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#fff0e6] text-[#ff6a00]">
          <ShoppingCart className="h-8 w-8" />
        </div>
        <h1 className="mt-5 text-[28px] font-black tracking-[-0.05em] text-[#1f2937]">Votre panier sourcing est vide</h1>
        <p className="mt-3 text-[14px] leading-6 text-[#667085]">Ajoutez des produits pour calculer automatiquement le poids total, le volume CBM, les options avion/bateau et vos tarifs finaux dans votre devise.</p>
        <Link href="/products" className="mt-6 inline-flex h-12 items-center justify-center rounded-full bg-[#ff6a00] px-6 text-[15px] font-semibold text-white transition hover:bg-[#e55e00]">
          Retour au catalogue
        </Link>
      </section>
    );
  }

  return (
    <div className="grid gap-4 lg:gap-6 xl:grid-cols-[minmax(0,1fr)_440px]">
      <div className="space-y-5">
        {sharedCartContext ? (
          <section className="rounded-[24px] border border-[#d8e5fb] bg-[linear-gradient(135deg,#eef6ff_0%,#ffffff_100%)] px-5 py-4 shadow-[0_16px_36px_rgba(29,79,145,0.08)]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#1d4f91]">Panier importé</div>
                <div className="mt-1 text-[16px] font-bold text-[#1f2937]">Ce panier a été créé par {sharedCartContext.ownerDisplayName}</div>
                <div className="mt-1 text-[13px] leading-6 text-[#50637d]">Le suivi et le paiement seront rattachés à votre compte. L’historique de commande indiquera clairement le créateur tiers du panier.</div>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[12px] font-semibold text-[#1d4f91] ring-1 ring-[#d8e5fb]">
                <Share2 className="h-4 w-4" />
                Panier tiers actif
              </div>
            </div>
          </section>
        ) : null}

      <section className="rounded-[20px] border border-[#ededed] bg-white px-4 py-5 shadow-[0_10px_28px_rgba(17,24,39,0.04)] sm:px-8 sm:py-6">
        <div className="mb-4 flex items-center justify-between sm:hidden">
          <div className="text-[26px] font-black tracking-[-0.05em] text-[#111827]">Panier ({items.length})</div>
          <div className="flex items-center gap-3 text-[#111827]">
            <button type="button" onClick={scrollToDeliveryInfo} className="inline-flex items-center gap-1 rounded-full px-1 py-1 text-[13px] font-medium transition hover:bg-[#f8fafc]" aria-label="Voir les informations de livraison">
              <MapPin className="h-5 w-5" />
              <span>{initialCountryCode}</span>
            </button>
            <button type="button" onClick={shareCart} disabled={isSharing} className="inline-flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-[#f8fafc] disabled:opacity-60" aria-label="Partager le panier">
              <Package className="h-6 w-6" />
            </button>
            <button type="button" onClick={goToFavorites} className="inline-flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-[#f8fafc]" aria-label="Voir les favoris">
              <Heart className="h-6 w-6" />
            </button>
            <button type="button" onClick={removeSelectedItems} disabled={selectedCount === 0} className="inline-flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-[#fff5f5] disabled:opacity-40" aria-label="Supprimer la sélection">
              <Trash2 className="h-6 w-6" />
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="hidden sm:block">
            <h1 className="text-[24px] font-black tracking-[-0.04em] text-[#1f2937] sm:text-[34px]">Panier ({items.length})</h1>
            <div className="mt-4 flex flex-wrap items-center gap-3 sm:mt-6">
              <button
                type="button"
                onClick={toggleAllItemsSelection}
                className={[
                  "inline-flex items-center gap-3 text-[14px] text-[#1f2937] transition sm:text-[15px]",
                  selectionPulse ? "scale-[1.02]" : "",
                ].join(" ")}
              >
                {allItemsSelected ? (
                  <CheckCircle2 className="h-5 w-5 text-[#f80632] sm:h-6 sm:w-6" />
                ) : (
                  <Circle className="h-5 w-5 text-[#d0d5dd] sm:h-6 sm:w-6" />
                )}
                <span>Sélectionner tous les articles</span>
              </button>
              <span className="rounded-full bg-[#f8fafc] px-3 py-1 text-[12px] font-semibold text-[#475467]">
                {selectedCount} sélectionné{selectedCount > 1 ? "s" : ""}
              </span>
              <button
                type="button"
                onClick={removeSelectedItems}
                disabled={selectedCount === 0}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-[#fecaca] bg-[#fff5f5] px-4 text-[12px] font-semibold text-[#d92d20] transition hover:bg-[#ffe9e9] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Supprimer la sélection
              </button>
            </div>
          </div>
          <div className="hidden w-full max-w-[360px] sm:block">
            <div className="flex items-center justify-between gap-3 text-[14px] font-semibold text-[#1f2937] sm:text-[15px]">
              <div className="inline-flex items-center gap-2">
                <Share2 className="h-4 w-4" />
                Partager ce panier
              </div>
              <button
                type="button"
                onClick={shareCart}
                disabled={isSharing || !isAuthenticated}
                className={[
                  "inline-flex h-10 items-center justify-center rounded-full px-4 text-[13px] font-semibold text-white transition",
                  sharePulse ? "bg-[#ff4d4f] shadow-[0_14px_30px_rgba(255,77,79,0.24)]" : "bg-[#f80632] hover:bg-[#db042c]",
                ].join(" ")}
              >
                {isAuthenticated ? (isSharing ? "Préparation..." : "Partager") : "Connexion requise"}
              </button>
            </div>
            <input value={shareMessage} onChange={(event) => setShareMessage(event.target.value)} placeholder="Ex: valide ce panier pour moi" className="mt-3 h-10 w-full rounded-[14px] border border-[#e4e7ec] bg-[#fbfbfb] px-4 text-[13px] text-[#111827] outline-none placeholder:text-[#98a2b3] focus:border-[#f80632] sm:h-11 sm:text-[14px]" />
            {shareFeedback ? <div className="mt-3 rounded-[14px] bg-[#f8fafc] px-4 py-3 text-[13px] font-medium text-[#475467]">{shareFeedback}</div> : null}
          </div>
        </div>
        <div className="mt-4 rounded-[16px] border border-[#d8e5fb] bg-[linear-gradient(135deg,#eef6ff_0%,#ffffff_100%)] px-4 py-4 shadow-[0_10px_24px_rgba(29,79,145,0.08)] sm:hidden">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#1d4f91] ring-1 ring-[#d8e5fb]">
                <Share2 className="h-3.5 w-3.5" />
                Partage panier
              </div>
              <div className="mt-3 text-[15px] font-bold text-[#1f2937] sm:text-[17px]">Un tiers peut ouvrir ce panier et le valider pour vous</div>
              <div className="mt-1 text-[12px] leading-5 text-[#50637d] sm:text-[13px] sm:leading-6">Partagez ce panier avec un proche ou un client. Le lien ouvre les articles déjà préparés, puis la personne peut confirmer et payer la commande depuis son compte.</div>
            </div>
            <button
              type="button"
              onClick={shareCart}
              disabled={isSharing || !isAuthenticated}
              className={[
                "inline-flex h-10 shrink-0 items-center justify-center rounded-full px-4 text-[13px] font-semibold text-white transition",
                sharePulse ? "bg-[#ff4d4f] shadow-[0_14px_30px_rgba(255,77,79,0.24)]" : "bg-[#f80632] hover:bg-[#db042c]",
              ].join(" ")}
            >
              {isAuthenticated ? (isSharing ? "Préparation..." : "Partager") : "Connexion requise"}
            </button>
          </div>
          <input value={shareMessage} onChange={(event) => setShareMessage(event.target.value)} placeholder="Ex: peux-tu valider ce panier pour moi ?" className="mt-3 h-10 w-full rounded-[14px] border border-[#d8e5fb] bg-white px-4 text-[13px] text-[#111827] outline-none placeholder:text-[#98a2b3] focus:border-[#1d4f91]" />
          {shareFeedback ? <div className="mt-3 rounded-[14px] bg-white px-4 py-3 text-[13px] font-medium text-[#475467] ring-1 ring-[#e4e7ec]">{shareFeedback}</div> : null}
        </div>
        <div className="mt-5 overflow-hidden rounded-[14px] border border-[#84c4ff] bg-white shadow-[0_12px_28px_rgba(47,103,246,0.12)]">
          <div className="flex items-center justify-between gap-3 rounded-t-[14px] bg-[linear-gradient(90deg,#30a3ff_0%,#2f67f6_100%)] px-4 py-3 text-white">
            <div className="hidden text-[13px] font-extrabold sm:text-[15px] sm:block">En plein air · Offre bienvenue</div>
            <div className="text-[13px] font-medium sm:hidden">Fin: 7 avril, 23:59 (CET)</div>
            <div className="hidden text-[13px] font-bold sm:text-[15px] sm:block">Fin : 7 avril, 21:59 (GMT0)</div>
            <span className="text-[22px] leading-none">›</span>
          </div>
          <div className="px-4 py-4 sm:px-5 sm:py-5">
            <div className="flex flex-wrap items-center gap-3">
              <div className="text-[34px] font-black tracking-[-0.06em] text-[#101828] sm:text-[56px]">{formatSourcingAmount(totalFcfa, { currencyCode, locale })}</div>
              <span className="inline-flex animate-[pulse_3.4s_ease-in-out_infinite] items-center rounded-[4px] bg-[#fff1f3] px-3 py-2 text-[13px] font-extrabold text-[#f80632] sm:text-[15px]">
                Economisez {formatSourcingAmount(welcomeDiscountFcfa, { currencyCode, locale })}
              </span>
            </div>
            <div className="mt-2 text-[16px] text-[#98a2b3] line-through sm:text-[18px]">{formatSourcingAmount(originalTotalFcfa, { currencyCode, locale })}</div>
            <div className="mt-3 text-[12px] text-[#475467] sm:text-[13px]">{shippingThresholdMessage}</div>
          </div>
        </div>
        <div className="mt-3 grid gap-2">
          {promoRows.map((promo) => {
            const Icon = promo.icon;
            return (
              <div key={promo.id} className={`flex items-center justify-between rounded-[12px] px-4 py-3 text-[14px] font-medium shadow-[0_6px_18px_rgba(17,24,39,0.04)] ${promo.accent}`}>
                <div className="inline-flex items-center gap-2">
                  <Icon className="h-4 w-4 animate-[pulse_3s_ease-in-out_infinite]" />
                  <span>{promo.label}</span>
                </div>
                <span className="text-[18px]">›</span>
              </div>
            );
          })}
        </div>
      </section>

      {initialSharedCartSummaries.length > 0 ? (
        <section className="rounded-[20px] border border-[#ededed] bg-white p-5 shadow-[0_10px_28px_rgba(17,24,39,0.04)]">
          <div className="text-[15px] font-bold text-[#1f2937]">Autre(s) paniers chainés</div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {initialSharedCartSummaries.map((entry) => (
              <article key={entry.id} className="rounded-[16px] border border-[#edf1f6] px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[14px] font-semibold text-[#1f2937]">Lien #{entry.token.slice(0, 8)}</div>
                  <span className="rounded-full bg-[#f8fafc] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#475467]">{entry.status}</span>
                </div>
                <div className="mt-2 text-[13px] leading-6 text-[#667085]">
                  {entry.status === "ordered" && entry.claimedByDisplayName
                    ? `Validé par ${entry.claimedByDisplayName}${entry.claimedOrderId ? ` · commande ${entry.claimedOrderId}` : ""}`
                    : entry.status === "claimed" && entry.claimedByDisplayName
                      ? `Importé par ${entry.claimedByDisplayName}`
                      : "En attente d’ouverture par un tiers."}
                </div>
                <div className="mt-2 text-[12px] text-[#98a2b3]">{entry.claimCount} importation(s) · mise à jour {new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(entry.updatedAt))}</div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-[20px] border border-[#ededed] bg-white p-3 shadow-[0_10px_28px_rgba(17,24,39,0.04)] sm:p-6">
        <div className="mb-3 sm:hidden">
          <div className="inline-flex rounded-[10px] bg-[#f5f5f5] px-3 py-2 text-[14px] font-medium text-[#344054]">
            <span className="rounded-[6px] bg-[#ffe784] px-2 py-0.5 text-[12px] font-bold text-[#5d4600]">Choice</span>
            <span className="ml-2">Livraison gratuite</span>
          </div>
        </div>
        <div className="flex items-center gap-3 border-b border-[#f2f4f7] pb-3 sm:pb-4">
          <button type="button" onClick={toggleAllItemsSelection} className="transition hover:scale-105">
            {allItemsSelected ? <CheckCircle2 className="h-6 w-6 text-[#f80632] sm:h-7 sm:w-7" /> : <Circle className="h-6 w-6 text-[#d0d5dd] sm:h-7 sm:w-7" />}
          </button>
          <span className="rounded-[6px] bg-[#ffe784] px-2 py-1 text-[12px] font-bold text-[#5d4600]">Choice</span>
          <div className="flex items-center gap-2 text-[14px] font-bold text-[#1f2937] sm:text-[18px]">
            Expédié par AfriPay
            <BadgeHelp className="h-4 w-4 text-[#98a2b3]" />
          </div>
        </div>
        <div className="px-0 pt-3 text-[13px] font-semibold text-[#1f2937] sm:px-9 sm:text-[14px]">Livraison gratuite</div>
        <div className="mt-3 space-y-2.5 sm:mt-4 sm:space-y-4">
          {quote.items.map((item) => {
            const cartItem = items.find((entry) => buildCartItemKey(entry.slug, entry.selectedVariants) === (item.cartKey ?? item.slug));
            const quantity = cartItem?.quantity ?? item.quantity;
            const variantEntries = Object.entries(item.selectedVariants ?? {});
            const weightLabel = item.weightKg > 0 ? `${item.weightKg.toFixed(2)} kg` : totalWeightLabel;
            const volumeLabel = item.volumeCbm > 0 ? `${item.volumeCbm.toFixed(4)} CBM` : totalVolumeLabel;
            const cartKey = item.cartKey ?? item.slug;
            const isSelected = selectedCartKeys.includes(cartKey);
            const isFavorite = favoriteSlugs.includes(item.slug);
            const primaryVariantLabel = variantEntries.length > 0
              ? variantEntries.map(([label, value]) => `${label}: ${value}`).join(" · ")
              : null;

            return (
              <article key={cartKey} className={[
                "grid gap-2.5 border-t border-[#f2f4f7] pt-3 transition sm:grid-cols-[24px_132px_minmax(0,1fr)_136px] sm:items-start sm:gap-4 sm:pt-5",
                isSelected ? "rounded-[18px] bg-[#fffdfd] shadow-[0_10px_24px_rgba(248,6,50,0.05)]" : "",
              ].join(" ")}>
                <div className="hidden pt-8 sm:block">
                  <button type="button" onClick={() => toggleCartItemSelection(cartKey)} className="transition hover:scale-105" aria-label={isSelected ? "Désélectionner l'article" : "Sélectionner l'article"}>
                    {isSelected ? <CheckCircle2 className="h-7 w-7 text-[#f80632]" /> : <Circle className="h-7 w-7 text-[#d0d5dd]" />}
                  </button>
                </div>
                <div className="relative hidden h-[92px] overflow-hidden rounded-[14px] bg-[#f5f5f5] sm:block sm:h-[132px] sm:rounded-[16px]">
                  <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-[#34c759] px-3 py-1 text-[11px] font-bold text-white">
                    <span>ALL</span>
                    <span>Free</span>
                  </div>
                  <Image src={item.image} alt={item.title} fill sizes="(max-width: 640px) 92px, 132px" className="object-cover pt-6" />
                </div>
                <div className="min-w-0 sm:hidden">
                  <div className="flex items-start gap-2.5">
                    <button type="button" onClick={() => toggleCartItemSelection(cartKey)} className="mt-8 inline-flex shrink-0 items-center gap-2 text-[12px] font-semibold text-[#667085]">
                      {isSelected ? <CheckCircle2 className="h-5 w-5 text-[#f80632]" /> : <Circle className="h-5 w-5 text-[#d0d5dd]" />}
                    </button>
                    <div className="relative h-[92px] w-[92px] shrink-0 overflow-hidden rounded-[14px] bg-[#f5f5f5]">
                      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-[#34c759] px-2 py-1 text-[10px] font-bold text-white">
                        <span>ALL</span>
                        <span>Free</span>
                      </div>
                      <Image src={item.image} alt={item.title} fill sizes="92px" className="object-cover pt-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[15px] font-semibold leading-5 text-[#1f2937]">{item.title}</div>
                      {primaryVariantLabel ? (
                        <div className="mt-1 truncate text-[12px] text-[#667085]">{primaryVariantLabel} ›</div>
                      ) : null}
                      <div className="mt-1.5 text-[14px] font-black tracking-[-0.03em] text-[#1f2937]">{formatSourcingAmount(item.finalLinePriceFcfa, { currencyCode, locale })}</div>
                      <div className="mt-1 inline-flex w-fit items-center gap-1 rounded-[8px] border border-[#ffd5dc] bg-[#fff7f8] px-2 py-0.5 text-[10px] font-bold text-[#f80632]">
                        <TicketPercent className="h-3 w-3" />
                        Éligible coupons
                      </div>
                      <div className="mt-1 text-[11px] text-[#98a2b3]">AfriPay Store ›</div>
                      <div className="mt-2 flex items-center justify-end">
                        <div className="inline-flex h-9 items-center rounded-full border border-[#e4e7ec] bg-white px-1 text-[#101828] shadow-[0_4px_14px_rgba(15,23,42,0.05)]">
                          <button type="button" onClick={() => updateItem(item.cartKey ?? item.slug, quantity - 1)} className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[#344054] transition hover:bg-[#f8fafc] hover:text-[#f80632]">
                            <Minus className="h-4 w-4" />
                          </button>
                          <div className="min-w-[24px] text-center text-[15px] font-semibold">{quantity}</div>
                          <button type="button" onClick={() => updateItem(item.cartKey ?? item.slug, quantity + 1)} className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[#344054] transition hover:bg-[#f8fafc] hover:text-[#f80632]">
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="hidden min-w-0 sm:block">
                  <button type="button" onClick={() => toggleCartItemSelection(cartKey)} className="mb-2 inline-flex items-center gap-2 text-[12px] font-semibold text-[#667085] sm:hidden">
                    {isSelected ? <CheckCircle2 className="h-4.5 w-4.5 text-[#f80632]" /> : <Circle className="h-4.5 w-4.5 text-[#d0d5dd]" />}
                    {isSelected ? "Sélectionné" : "Sélectionner"}
                  </button>
                  <div className="flex flex-col gap-1.5 sm:gap-2">
                    <div className="text-[15px] font-semibold leading-6 text-[#1f2937] sm:text-[18px] sm:leading-7">{item.title}</div>
                    <div className="text-[13px] font-black tracking-[-0.03em] text-[#1f2937] sm:text-[14px]">{formatSourcingAmount(item.finalLinePriceFcfa, { currencyCode, locale })}</div>
                    <div className="inline-flex w-fit items-center gap-1 rounded-full bg-[#fff1f3] px-2.5 py-1 text-[11px] font-bold text-[#f80632] sm:text-[13px]">
                      <TicketPercent className="h-3.5 w-3.5" />
                      Coupons utilisables
                    </div>
                    <div className="text-[12px] text-[#98a2b3] sm:text-[14px]">AfriPay Store ›</div>
                    <div className="text-[12px] font-semibold text-[#1f2937] sm:text-[14px]">Frais de livraison : Livraison gratuite</div>
                    <div className="text-[12px] text-[#667085] sm:text-[14px]">Livraison : {shipping?.deliveryWindow ?? "5-10 jours"}</div>
                    <div className="text-[12px] text-[#667085] sm:text-[14px]">Courrier : Colissimo, Mondial Relay, Colis Privé, etc.</div>
                    <div className="text-[12px] text-[#475467] sm:text-[14px]">Poids : {weightLabel} · Volume : {volumeLabel}</div>
                    {variantEntries.length > 0 ? (
                      <div className="mt-1 flex flex-wrap gap-2">
                        {variantEntries.map(([label, value]) => (
                          <span key={`${label}-${value}`} className="rounded-full bg-[#f8fafc] px-3 py-1 text-[12px] font-semibold text-[#475467] ring-1 ring-[#e4e7ec]">
                            {label}: {value}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="hidden items-center gap-2 self-center sm:flex sm:justify-end">
                  <button type="button" onClick={() => updateItem(item.cartKey ?? item.slug, quantity - 1)} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#d0d5dd] bg-white text-[#344054] transition hover:border-[#f80632] hover:text-[#f80632] sm:h-11 sm:w-11">
                    <Minus className="h-4 w-4" />
                  </button>
                  <div className="min-w-[24px] text-center text-[16px] font-semibold text-[#1f2937] sm:min-w-[28px] sm:text-[18px]">{quantity}</div>
                  <button type="button" onClick={() => updateItem(item.cartKey ?? item.slug, quantity + 1)} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#d0d5dd] bg-white text-[#344054] transition hover:border-[#f80632] hover:text-[#f80632] sm:h-11 sm:w-11">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <div className="hidden grid-cols-3 gap-2 pt-1 sm:col-span-4 sm:ml-[calc(24px+132px+16px)] sm:grid sm:max-w-[440px]">
                  <button type="button" onClick={() => void shareProduct(item.slug, item.title)} className="inline-flex h-10 items-center justify-center gap-2 rounded-[12px] border border-[#eceff3] bg-[#fafbfc] text-[13px] font-medium text-[#1f2937] transition hover:-translate-y-0.5 hover:border-[#d0d5dd]">
                    <Share2 className="h-4 w-4" />
                    Partager
                  </button>
                  <button type="button" onClick={() => void toggleFavorite(item.slug)} disabled={favoriteBusySlug === item.slug} className="inline-flex h-10 items-center justify-center gap-2 rounded-[12px] border border-[#eceff3] bg-[#fafbfc] text-[13px] font-medium text-[#1f2937] transition hover:-translate-y-0.5 hover:border-[#d0d5dd] disabled:opacity-60">
                    <Heart className={["h-4 w-4", isFavorite ? "fill-current text-[#f06f12]" : ""].join(" ")} />
                    Favori
                  </button>
                  <div className="inline-flex h-10 items-center justify-center gap-1 rounded-[12px] border border-[#eceff3] bg-[#fafbfc] text-[13px] font-medium text-[#1f2937]">
                    <Star className="h-4 w-4 fill-current text-[#f5b301]" />
                    Note 4.8
                  </div>
                </div>
                <div className="hidden sm:col-span-4 sm:ml-[calc(24px+132px+16px)] sm:block">
                  <button type="button" onClick={() => removeItem(item.cartKey ?? item.slug)} className="text-[13px] font-semibold text-[#d92d20] transition hover:opacity-80">
                    Retirer
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
      </div>

      <aside className="hidden space-y-4 xl:sticky xl:top-6 xl:self-start xl:block">
        <section className="rounded-[20px] border border-[#ededed] bg-white p-5 shadow-[0_10px_28px_rgba(17,24,39,0.04)] sm:p-6">
          <div className="text-[18px] font-black tracking-[-0.03em] text-[#1f2937] sm:text-[24px]">Résumé</div>
          <div className="mt-7 flex items-center justify-between gap-4">
            <div className="text-[18px] font-extrabold text-[#1f2937] sm:text-[22px]">Total estimé</div>
            <div className="text-[22px] font-black tracking-[-0.04em] text-[#1f2937] sm:text-[24px]">{formatSourcingAmount(totalFcfa, { currencyCode, locale })}</div>
          </div>
          <div className="mt-5 space-y-3 text-[15px] text-[#344054]">
            <div className="flex items-center justify-between">
              <span>Sous-total</span>
              <span className="font-semibold text-[#1f2937]">{formatSourcingAmount(quote.cartProductsTotalFcfa, { currencyCode, locale })}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Livraison</span>
              <span className="font-semibold text-[#1f2937]">{shipping ? (shipping.isFree ? "gratuit" : formatSourcingAmount(shipping.priceFcfa, { currencyCode, locale })) : formatSourcingAmount(0, { currencyCode, locale })}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Poids total</span>
              <span className="font-semibold text-[#1f2937]">{totalWeightLabel}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Volume total</span>
              <span className="font-semibold text-[#1f2937]">{totalVolumeLabel}</span>
            </div>
          </div>
          <Link href="/checkout" className="mt-6 inline-flex h-13 w-full items-center justify-center rounded-full bg-[#f80632] px-6 text-[16px] font-bold text-white transition hover:bg-[#dc042c] sm:mt-7 sm:h-14 sm:text-[17px]">
            Paiement ({items.length})
          </Link>
          <button type="button" onClick={clearCart} className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-full border border-[#d0d5dd] px-6 text-[14px] font-semibold text-[#344054] transition hover:border-[#f80632] hover:text-[#f80632] sm:h-12 sm:text-[15px]">
            Vider le panier
          </button>
          {isLoading ? <div className="mt-3 text-[12px] text-[#98a2b3]">Mise à jour du devis sourcing...</div> : null}
        </section>

        <section ref={deliveryInfoRef} className="rounded-[20px] border border-[#ededed] bg-white p-6 shadow-[0_10px_28px_rgba(17,24,39,0.04)]">
          <div className="flex items-start gap-4">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-[12px] bg-[#fff7e8] text-[#8d5a00]">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[18px] font-bold text-[#1f2937]">Livraison rapide</div>
              <div className="mt-2 space-y-1 text-[14px] leading-6 text-[#667085]">
                <div>1,00€ coupon pour livraison retardée</div>
                <div>Remboursement si les articles sont endommagés</div>
                <div>Remboursement si le colis est perdu</div>
                <div>Remboursement si non livré après 35 jours</div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[20px] border border-[#ededed] bg-white p-6 shadow-[0_10px_28px_rgba(17,24,39,0.04)]">
          <div className="flex items-start gap-4">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-[12px] bg-[#fff1f3] text-[#8e1b35]">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[18px] font-bold text-[#1f2937]">Sécurité et vie privée</div>
              <div className="mt-2 text-[14px] leading-6 text-[#667085]">Paiements sûrs. Informations personnelles sécurisées.</div>
            </div>
          </div>
        </section>

        <section className="rounded-[20px] border border-[#ededed] bg-white p-6 shadow-[0_10px_28px_rgba(17,24,39,0.04)]">
          <div className="flex items-start gap-4">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-[12px] bg-[#f4f5f7] text-[#344054]">
              <LockKeyhole className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[18px] font-bold text-[#1f2937]">Paiements sûrs</div>
              <div className="mt-2 text-[14px] leading-6 text-[#667085]">Avec les partenaires de paiement populaires, vos données personnelles sont en sécurité.</div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {paymentSecurityBadges.map((entry) => (
                  <PaymentSecurityBadge key={entry} brand={entry} />
                ))}
              </div>
            </div>
          </div>
        </section>
      </aside>

      <div className="space-y-4 xl:hidden">
        <section className="rounded-[20px] border border-[#ededed] bg-white p-5 shadow-[0_10px_28px_rgba(17,24,39,0.04)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[15px] font-bold text-[#111827]">
              <ShieldCheck className="h-5 w-5" />
              Services
            </div>
            <span className="text-[20px]">›</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <article className="rounded-[16px] bg-[#fafafa] p-4">
              <div className="text-[15px] font-bold text-[#1f2937]">Sécurité et vie privée</div>
              <div className="mt-2 text-[13px] leading-6 text-[#667085]">Paiements sûrs et informations personnelles sécurisées.</div>
            </article>
            <article className="rounded-[16px] bg-[#fafafa] p-4">
              <div className="text-[15px] font-bold text-[#1f2937]">Livraison rapide</div>
              <div className="mt-2 text-[13px] leading-6 text-[#667085]">Coupon retard et protections si le colis est perdu ou endommagé.</div>
            </article>
          </div>
        </section>

        <section className="rounded-[20px] border border-[#ededed] bg-white p-5 shadow-[0_10px_28px_rgba(17,24,39,0.04)]">
          <div className="flex items-center gap-2 text-[15px] font-bold text-[#111827]">
            <LockKeyhole className="h-5 w-5" />
            Paiements sûrs
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {paymentSecurityBadges.map((entry) => (
              <PaymentSecurityBadge key={entry} brand={entry} />
            ))}
          </div>
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-[var(--mobile-bottom-nav-height,0px)] z-[60] border-t border-[#eaecf0] bg-white px-3 py-2.5 shadow-[0_-12px_30px_rgba(17,24,39,0.08)] xl:hidden">
        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={toggleAllItemsSelection} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#111827]">
            {allItemsSelected ? <CheckCircle2 className="h-5 w-5 text-[#f80632]" /> : <Circle className="h-5 w-5 text-[#d0d5dd]" />}
            Tout
          </button>
          <div className="text-right">
            <div className="text-[24px] font-black tracking-[-0.05em] text-[#111827]">{formatSourcingAmount(selectedTotalFcfa, { currencyCode, locale })}</div>
            <div className="text-[11px] text-[#667085]">{selectedCount} article(s) · {selectedWeightKg.toFixed(2)} kg</div>
          </div>
          <Link href="/checkout" className="inline-flex h-11 min-w-[128px] items-center justify-center rounded-full bg-[#f80632] px-4 text-[15px] font-bold text-white transition hover:bg-[#dc042c]">
            Paiement ({selectedCount})
          </Link>
        </div>
      </div>
    </div>
  );
}
