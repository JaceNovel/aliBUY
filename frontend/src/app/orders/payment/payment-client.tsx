"use client";

import Image from "next/image";
import Link from "next/link";
import { CreditCard, WalletCards } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { applyOrderPromoCode, initializeOrderPayment, verifyOrderPayment, type PaymentProvider } from "@/lib/api";
import { PaymentMethodIcon } from "@/components/payment-method-icon";

type LegacyOrder = {
  kind: "legacy";
  id: string;
  title: string;
  seller: string;
  total: string;
  image: string;
};

type SourcingPaymentOrder = {
  kind: "sourcing";
  id: string;
  orderNumber: string;
  title: string;
  seller: string;
  total: string;
  image: string;
  itemCount: number;
  shippingMethod: "air" | "sea" | "freight";
  shippingLabel?: string;
  paymentStatus: "unpaid" | "initialized" | "pending" | "paid" | "failed" | "cancelled";
  paymentProvider?: PaymentProvider;
  paymentReference?: string;
  paymentCheckoutUrl?: string;
  paymentProviderStatus?: string;
  monerooPaymentId?: string;
  monerooCheckoutUrl?: string;
  monerooPaymentStatus?: string;
  paymentCurrency: string;
  promoCode?: string;
  promoDiscountLabel?: string;
  originalTotal?: string;
  thirdPartyCartCreatorName?: string;
  thirdPartyCartNotice?: string;
  returnPaymentId?: string;
  returnPaymentStatus?: string;
  returnProvider?: PaymentProvider;
  heading?: string;
  description?: string;
  badgeLabel?: string;
  backHref?: string;
  backLabel?: string;
  allowPromoCode?: boolean;
};

type PaymentClientProps = {
  order: LegacyOrder | SourcingPaymentOrder;
};

const paymentProviders = [
  {
    key: "moneroo" as const,
    label: "Moneroo",
    detail: "Carte bancaire, Mobile Money et moyens locaux dans le checkout heberge AfriPay.",
  },
  {
    key: "paypal" as const,
    label: "PayPal",
    detail: "Paiement international securise. Les montants FCFA sont debites en equivalent EUR.",
  },
];

function normalizePaymentProvider(input?: string | null): PaymentProvider {
  return input === "paypal" ? "paypal" : "moneroo";
}

function getProviderLabel(provider: PaymentProvider) {
  return provider === "paypal" ? "PayPal" : "Moneroo";
}

function getProviderDescription(provider: PaymentProvider, currency: string) {
  if (provider === "paypal") {
    return currency.toUpperCase() === "XOF"
      ? "AfriPay vous redirige vers PayPal. Le total reste affiche en FCFA ici, puis PayPal encaisse l'equivalent en EUR."
      : `AfriPay vous redirige vers PayPal pour encaisser la commande en ${currency}.`;
  }

  return `AfriPay initialise un checkout Moneroo securise pour encaisser la commande en ${currency}. Une verification serveur est relancee au retour pour confirmer le statut reel.`;
}

function getPaymentStatusLabel(paymentStatus: SourcingPaymentOrder["paymentStatus"]) {
  switch (paymentStatus) {
    case "initialized":
      return "Initialisee";
    case "pending":
      return "En attente";
    case "paid":
      return "Payee";
    case "failed":
      return "Echouee";
    case "cancelled":
      return "Annulee";
    default:
      return "Non payee";
  }
}

function getInitialPaymentReference(order: SourcingPaymentOrder) {
  return order.paymentReference || order.monerooPaymentId;
}

function getInitialPaymentCheckoutUrl(order: SourcingPaymentOrder) {
  return order.paymentCheckoutUrl || order.monerooCheckoutUrl;
}

function getInitialProviderStatus(order: SourcingPaymentOrder) {
  return order.paymentProviderStatus || order.monerooPaymentStatus;
}

export function PaymentClient({ order }: PaymentClientProps) {
  const initialProvider = order.kind === "sourcing"
    ? normalizePaymentProvider(order.returnProvider || order.paymentProvider)
    : "moneroo";

  const [selectedProvider, setSelectedProvider] = useState<PaymentProvider>(initialProvider);
  const [legacyNotice, setLegacyNotice] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState(order.kind === "sourcing" ? order.paymentStatus : "unpaid");
  const [promoCode, setPromoCode] = useState(order.kind === "sourcing" ? order.promoCode ?? "" : "");
  const [promoDiscountLabel, setPromoDiscountLabel] = useState(order.kind === "sourcing" ? order.promoDiscountLabel : undefined);
  const [displayTotal, setDisplayTotal] = useState(order.total);
  const [originalTotal, setOriginalTotal] = useState(order.kind === "sourcing" ? order.originalTotal : undefined);
  const [promoInput, setPromoInput] = useState("");
  const [paymentReference, setPaymentReference] = useState(order.kind === "sourcing" ? getInitialPaymentReference(order) : undefined);
  const [paymentCheckoutUrl, setPaymentCheckoutUrl] = useState(order.kind === "sourcing" ? getInitialPaymentCheckoutUrl(order) : undefined);
  const [paymentProviderStatus, setPaymentProviderStatus] = useState(order.kind === "sourcing" ? getInitialProviderStatus(order) : undefined);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isApplyingPromo, setIsApplyingPromo] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const verifiedReturnRef = useRef<string | null>(null);

  useEffect(() => {
    if (order.kind !== "sourcing") {
      return;
    }

    const returnKey = [order.id, order.returnPaymentId ?? "", order.returnPaymentStatus ?? "", order.returnProvider ?? ""].join("|");
    if (!order.returnPaymentId && !order.returnPaymentStatus) {
      return;
    }

    if (verifiedReturnRef.current === returnKey) {
      return;
    }

    const returnProvider = normalizePaymentProvider(order.returnProvider || order.paymentProvider);
    const providerLabel = getProviderLabel(returnProvider);

    verifiedReturnRef.current = returnKey;
    setSelectedProvider(returnProvider);
    setFeedbackMessage(order.returnPaymentStatus ? `Retour ${providerLabel} recu: ${order.returnPaymentStatus}. Verification en cours.` : `Verification du paiement ${providerLabel} en cours.`);
    setIsVerifying(true);

    void verifyOrderPayment(order.id, order.returnPaymentId, returnProvider)
      .then((payload) => {
        setPaymentStatus(payload.order.paymentStatus);
        setPaymentReference(payload.paymentId || payload.order.paymentReference || payload.order.monerooPaymentId);
        setPaymentCheckoutUrl(payload.checkoutUrl || payload.order.paymentCheckoutUrl || payload.order.monerooCheckoutUrl);
        setPaymentProviderStatus(payload.order.paymentProviderStatus || payload.order.monerooPaymentStatus);
        setFeedbackMessage(payload.order.paymentStatus === "paid"
          ? "Paiement confirme. La commande est maintenant marquee comme payee."
          : `Paiement verifie avec le statut ${payload.order.paymentProviderStatus || payload.order.monerooPaymentStatus || payload.order.paymentStatus}.`);
      })
      .catch((error) => {
        setFeedbackMessage(error instanceof Error ? error.message : `La verification ${providerLabel} a echoue.`);
      })
      .finally(() => {
        setIsVerifying(false);
      });
  }, [order]);

  const initializeHostedCheckout = async () => {
    if (order.kind !== "sourcing") {
      setLegacyNotice("Le paiement en ligne n'est pas disponible pour cette ancienne commande depuis cet ecran.");
      return;
    }

    if (paymentStatus === "paid") {
      setFeedbackMessage("Cette commande est deja payee.");
      return;
    }

    const providerLabel = getProviderLabel(selectedProvider);

    setIsInitializing(true);
    setFeedbackMessage(null);

    try {
      const payload = await initializeOrderPayment(order.id, selectedProvider);

      if (!payload?.checkoutUrl) {
        throw new Error(`Impossible d'ouvrir le checkout ${providerLabel}.`);
      }

      setPaymentStatus(payload.order?.paymentStatus || "initialized");
      setPaymentReference(payload.paymentId || payload.order?.paymentReference || payload.order?.monerooPaymentId);
      setPaymentCheckoutUrl(payload.checkoutUrl || payload.order?.paymentCheckoutUrl || payload.order?.monerooCheckoutUrl);
      setPaymentProviderStatus(payload.order?.paymentProviderStatus || payload.order?.monerooPaymentStatus);
      window.location.href = payload.checkoutUrl;
    } catch (error) {
      setFeedbackMessage(error instanceof Error ? error.message : `Impossible d'ouvrir le checkout ${providerLabel}.`);
    } finally {
      setIsInitializing(false);
    }
  };

  const verifyCurrentPayment = async () => {
    if (order.kind !== "sourcing") {
      return;
    }

    const providerLabel = getProviderLabel(selectedProvider);
    const currentPaymentId = paymentReference || order.returnPaymentId;
    if (!currentPaymentId) {
      setFeedbackMessage(`Aucun paiement ${providerLabel} n'est associe a cette commande pour le moment.`);
      return;
    }

    setIsVerifying(true);
    setFeedbackMessage(null);

    try {
      const payload = await verifyOrderPayment(order.id, currentPaymentId, selectedProvider);

      setPaymentStatus(payload.order.paymentStatus);
      setPaymentReference(payload.paymentId || payload.order.paymentReference || payload.order.monerooPaymentId);
      setPaymentCheckoutUrl(payload.checkoutUrl || payload.order.paymentCheckoutUrl || payload.order.monerooCheckoutUrl);
      setPaymentProviderStatus(payload.order.paymentProviderStatus || payload.order.monerooPaymentStatus);
      setFeedbackMessage(payload.order.paymentStatus === "paid"
        ? `Paiement confirme par ${providerLabel}.`
        : `Dernier statut ${providerLabel}: ${payload.order.paymentProviderStatus || payload.order.monerooPaymentStatus || payload.order.paymentStatus}.`);
    } catch (error) {
      setFeedbackMessage(error instanceof Error ? error.message : `Impossible de verifier le paiement ${providerLabel}.`);
    } finally {
      setIsVerifying(false);
    }
  };

  const applyPromoCode = async () => {
    if (order.kind !== "sourcing") {
      return;
    }

    if (!promoInput.trim()) {
      setFeedbackMessage("Saisissez un code promo.");
      return;
    }

    setIsApplyingPromo(true);
    setFeedbackMessage(null);

    try {
      const payload = await applyOrderPromoCode(order.id, promoInput);

      setPromoCode(payload.promoCode || promoInput.trim().toUpperCase());
      setPromoDiscountLabel(payload.promoDiscountLabel);
      setOriginalTotal(payload.originalTotal);
      setDisplayTotal(payload.total || order.total);
      setFeedbackMessage(`Code ${payload.promoCode} applique sur la commande.`);
    } catch (error) {
      setFeedbackMessage(error instanceof Error ? error.message : "Impossible d'appliquer ce code promo.");
    } finally {
      setIsApplyingPromo(false);
    }
  };

  if (order.kind === "sourcing") {
    const shippingLabel = /^(Expédition|Expedition)\s+[A-Z]{2,3}$/i.test(order.shippingLabel || "")
      ? "Expédition"
      : order.shippingLabel || (order.shippingMethod === "sea" ? "Fret maritime groupe" : order.shippingMethod === "freight" ? "Fret local AfriPay" : "Fret aerien");
    const statusLabel = getPaymentStatusLabel(paymentStatus);
    const heading = order.heading || "Finaliser la commande sourcing";
    const description = order.description || getProviderDescription(selectedProvider, order.paymentCurrency);
    const badgeLabel = order.badgeLabel || `Paiement ${getProviderLabel(selectedProvider)}`;
    const backHref = order.backHref || "/orders";
    const backLabel = order.backLabel || "Retour aux commandes";
    const allowPromoCode = order.allowPromoCode !== false;

    return (
      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-[28px] bg-white px-5 py-5 shadow-[0_8px_30px_rgba(24,39,75,0.05)] ring-1 ring-black/5 sm:px-7 sm:py-7">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#fff2e9] px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#d85300]">
            <WalletCards className="h-4 w-4" />
            {badgeLabel}
          </div>
          <h1 className="mt-4 text-[28px] font-bold tracking-[-0.05em] text-[#222] sm:text-[40px]">{heading}</h1>
          <p className="mt-2 max-w-[760px] text-[14px] leading-6 text-[#666] sm:text-[16px] sm:leading-8">
            {description}
          </p>
          {order.thirdPartyCartNotice ? <div className="mt-4 rounded-[18px] border border-[#d8e5fb] bg-[#eef6ff] px-4 py-4 text-[14px] font-medium text-[#1d4f91]">{order.thirdPartyCartNotice}</div> : null}

          {feedbackMessage ? (
            <div className={["mt-5 rounded-[18px] border px-4 py-4 text-[14px] font-medium", paymentStatus === "paid" ? "border-[#c8ead1] bg-[#effbf2] text-[#1f7a39]" : paymentStatus === "failed" || paymentStatus === "cancelled" ? "border-[#f5c2c7] bg-[#fff1f2] text-[#b42318]" : "border-[#f3d7bf] bg-[#fff7f1] text-[#8a4b16]"].join(" ")}>
              {feedbackMessage}
            </div>
          ) : null}

          <div className="mt-6 grid gap-3">
            {paymentProviders.map((provider) => {
              const isSelected = selectedProvider === provider.key;
              const isPayPal = provider.key === "paypal";

              return (
                <button
                  key={provider.key}
                  type="button"
                  onClick={() => setSelectedProvider(provider.key)}
                  className={[
                    "flex w-full items-start gap-3 rounded-[20px] border px-4 py-4 text-left transition",
                    isSelected
                      ? (isPayPal ? "border-[#1457d8] bg-[#eef6ff] shadow-[inset_0_0_0_1px_#1457d8]" : "border-[#ff6a00] bg-[#fff5ed] shadow-[inset_0_0_0_1px_#ff6a00]")
                      : "border-[#e5e5e5] bg-white hover:border-[#ffb48a]",
                  ].join(" ")}
                >
                  <div className={[
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-white ring-1 ring-black/5",
                    isPayPal ? "text-[#1457d8]" : "text-[#ff6a00]",
                  ].join(" ")}>
                    {provider.key === "paypal"
                      ? <span className="text-[15px] font-black tracking-[0.02em]">PP</span>
                      : <WalletCards className="h-5 w-5" />}
                  </div>
                  <div>
                    <div className="text-[16px] font-semibold text-[#222]">{provider.label}</div>
                    <div className="mt-1 text-[13px] leading-5 text-[#666]">{provider.detail}</div>
                  </div>
                </button>
              );
            })}

            {selectedProvider === "moneroo" ? (
              <div className="flex w-full items-start gap-3 rounded-[20px] border border-[#ffddb9] bg-[#fff6ee] px-4 py-4 text-left">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-white text-[#ff6a00] ring-1 ring-black/5">
                  <PaymentMethodIcon kind="mobile-money" size={22} className="h-[22px] w-[22px] object-contain" />
                </div>
                <div>
                  <div className="text-[16px] font-semibold text-[#222]">Carte bancaire et Mobile Money</div>
                  <div className="mt-1 text-[13px] leading-5 text-[#666]">Le checkout Moneroo permet de finaliser la commande avec les moyens locaux pris en charge.</div>
                </div>
              </div>
            ) : (
              <div className="flex w-full items-start gap-3 rounded-[20px] border border-[#d7e7ff] bg-[#f5f9ff] px-4 py-4 text-left">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-white text-[#1457d8] ring-1 ring-black/5">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[16px] font-semibold text-[#222]">Redirection PayPal</div>
                  <div className="mt-1 text-[13px] leading-5 text-[#666]">Vous serez redirige vers PayPal puis AfriPay relancera automatiquement la verification a votre retour.</div>
                </div>
              </div>
            )}
          </div>

          {paymentStatus === "unpaid" && allowPromoCode ? (
            <div className="mt-6 rounded-[20px] border border-[#e7ebf1] bg-[#f8fafc] px-4 py-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#ff6a00]">Code promo</div>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <input
                  value={promoInput}
                  onChange={(event) => setPromoInput(event.target.value.toUpperCase())}
                  placeholder={promoCode || "Ex: WELCOME10"}
                  className="h-11 flex-1 rounded-[14px] border border-[#d7dce5] bg-white px-4 text-[14px] text-[#111827] outline-none focus:border-[#ff6a00]"
                />
                <button
                  type="button"
                  onClick={applyPromoCode}
                  disabled={isApplyingPromo || isInitializing || isVerifying || Boolean(promoCode)}
                  className="inline-flex h-11 items-center justify-center rounded-full bg-[#143743] px-5 text-[13px] font-semibold text-white transition hover:bg-[#102d36] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {promoCode ? "Deja applique" : isApplyingPromo ? "Application..." : "Appliquer"}
                </button>
              </div>
            </div>
          ) : null}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={initializeHostedCheckout}
              disabled={isInitializing || isVerifying || isApplyingPromo || paymentStatus === "paid"}
              className="inline-flex h-12 items-center justify-center rounded-full bg-[#ea5c00] px-6 text-[15px] font-semibold text-white transition hover:bg-[#d85400] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {paymentStatus === "paid"
                ? "Commande payee"
                : isInitializing
                  ? "Ouverture du checkout..."
                  : paymentStatus === "initialized" || paymentStatus === "pending"
                    ? "Reprendre le paiement"
                    : `Payer avec ${getProviderLabel(selectedProvider)}`}
            </button>
            <button
              type="button"
              onClick={verifyCurrentPayment}
              disabled={isInitializing || isVerifying || !paymentReference}
              className="inline-flex h-12 items-center justify-center rounded-full border border-[#222] px-6 text-[15px] font-semibold text-[#222] transition hover:border-[#ff6a00] hover:text-[#ff6a00] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isVerifying ? "Verification..." : "Verifier le paiement"}
            </button>
            <Link href={backHref} className="inline-flex h-12 items-center justify-center rounded-full border border-[#d7dce5] px-6 text-[15px] font-semibold text-[#475467] transition hover:border-[#ff6a00] hover:text-[#ff6a00]">
              {backLabel}
            </Link>
          </div>
        </section>

        <aside className="rounded-[28px] bg-white px-5 py-5 shadow-[0_8px_30px_rgba(24,39,75,0.05)] ring-1 ring-black/5 sm:px-7 sm:py-7">
          <div className="flex gap-4">
            <div className="relative h-[92px] w-[92px] shrink-0 overflow-hidden rounded-[18px] bg-[#f4f4f4]">
              <Image src={order.image} alt={order.title} fill sizes="92px" className="object-cover" />
            </div>
            <div className="min-w-0">
              <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#7b7b7b]">Commande sourcing</div>
              <div className="mt-1 break-all text-[15px] font-semibold text-[#222]">{order.orderNumber}</div>
              <div className="mt-2 line-clamp-2 text-[14px] leading-5 text-[#444]">{order.title}</div>
            </div>
          </div>

          <div className="mt-5 space-y-3 rounded-[20px] bg-[#fafafa] px-4 py-4 ring-1 ring-black/5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[12px] text-[#777]">Montant a payer</div>
                <div className="mt-1 text-[22px] font-bold tracking-[-0.04em] text-[#ea5c00]">{displayTotal}</div>
                {originalTotal ? <div className="mt-1 text-[12px] text-[#667085]">Avant reduction: {originalTotal}</div> : null}
              </div>
              <div className="rounded-full bg-[#fff2e9] px-3 py-1 text-[12px] font-semibold uppercase tracking-[0.12em] text-[#d85300]">{statusLabel}</div>
            </div>
            {promoCode && promoDiscountLabel ? (
              <div>
                <div className="text-[12px] text-[#777]">Code promo</div>
                <div className="mt-1 text-[15px] font-semibold text-[#1f7a39]">{promoCode} · -{promoDiscountLabel}</div>
              </div>
            ) : null}
            {order.thirdPartyCartCreatorName ? (
              <div>
                <div className="text-[12px] text-[#777]">Createur du panier tiers</div>
                <div className="mt-1 text-[15px] font-semibold text-[#222]">{order.thirdPartyCartCreatorName}</div>
              </div>
            ) : null}
            <div>
              <div className="text-[12px] text-[#777]">Livraison</div>
              <div className="mt-1 text-[15px] font-semibold text-[#222]">{shippingLabel}</div>
            </div>
            <div>
              <div className="text-[12px] text-[#777]">Articles</div>
              <div className="mt-1 text-[15px] font-semibold text-[#222]">{order.itemCount} article{order.itemCount > 1 ? "s" : ""}</div>
            </div>
            <div>
              <div className="text-[12px] text-[#777]">Paiement {getProviderLabel(selectedProvider)}</div>
              <div className="mt-1 break-all text-[15px] font-semibold text-[#222]">{paymentReference || "Pas encore initialise"}</div>
            </div>
            {paymentProviderStatus ? (
              <div>
                <div className="text-[12px] text-[#777]">Statut prestataire</div>
                <div className="mt-1 text-[15px] font-semibold text-[#222]">{paymentProviderStatus}</div>
              </div>
            ) : null}
            {paymentCheckoutUrl ? (
              <Link href={paymentCheckoutUrl} className="inline-flex text-[13px] font-semibold text-[#ea5c00] transition hover:text-[#c94d00]">
                Reouvrir le checkout {getProviderLabel(selectedProvider)}
              </Link>
            ) : null}
          </div>
        </aside>
      </div>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
      <section className="rounded-[28px] bg-white px-5 py-5 shadow-[0_8px_30px_rgba(24,39,75,0.05)] ring-1 ring-black/5 sm:px-7 sm:py-7">
        <div className="inline-flex items-center gap-2 rounded-full bg-[#fff2e9] px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#d85300]">
          <WalletCards className="h-4 w-4" />
          Paiement de commande
        </div>
        <h1 className="mt-4 text-[28px] font-bold tracking-[-0.05em] text-[#222] sm:text-[40px]">Payer maintenant</h1>
        <p className="mt-2 max-w-[760px] text-[14px] leading-6 text-[#666] sm:text-[16px] sm:leading-8">
          Choisissez votre prestataire de paiement pour valider la commande et lancer le traitement AfriPay.
        </p>

        {legacyNotice ? (
          <div className="mt-5 rounded-[18px] border border-[#f3d7bf] bg-[#fff7f1] px-4 py-4 text-[14px] font-medium text-[#8a4b16]">
            {legacyNotice}
          </div>
        ) : null}

        <div className="mt-6 space-y-3">
          {paymentProviders.map((provider) => {
            const isSelected = selectedProvider === provider.key;

            return (
              <button
                key={provider.key}
                type="button"
                onClick={() => setSelectedProvider(provider.key)}
                className={[
                  "flex w-full items-start gap-3 rounded-[20px] border px-4 py-4 text-left transition",
                  isSelected ? "border-[#ff6a00] bg-[#fff5ed] shadow-[inset_0_0_0_1px_#ff6a00]" : "border-[#e5e5e5] bg-white hover:border-[#ffb48a]",
                ].join(" ")}
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-white text-[#ff6a00] ring-1 ring-black/5">
                  {provider.key === "paypal"
                    ? <span className="text-[15px] font-black tracking-[0.02em] text-[#1457d8]">PP</span>
                    : <CreditCard className="h-5 w-5" />}
                </div>
                <div>
                  <div className="text-[16px] font-semibold text-[#222]">{provider.label}</div>
                  <div className="mt-1 text-[13px] leading-5 text-[#666]">{provider.detail}</div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => setLegacyNotice(`Cette commande ancienne ne peut pas etre marquee comme payee ici. Utilisez une commande sourcing pour ouvrir ${getProviderLabel(selectedProvider)}.`)}
            className="inline-flex h-12 items-center justify-center rounded-full bg-[#ea5c00] px-6 text-[15px] font-semibold text-white transition hover:bg-[#d85400]"
          >
            Paiement en ligne indisponible
          </button>
          <Link href="/orders" className="inline-flex h-12 items-center justify-center rounded-full border border-[#222] px-6 text-[15px] font-semibold text-[#222] transition hover:border-[#ff6a00] hover:text-[#ff6a00]">
            Retour aux commandes
          </Link>
        </div>
      </section>

      <aside className="rounded-[28px] bg-white px-5 py-5 shadow-[0_8px_30px_rgba(24,39,75,0.05)] ring-1 ring-black/5 sm:px-7 sm:py-7">
        <div className="flex gap-4">
          <div className="relative h-[92px] w-[92px] shrink-0 overflow-hidden rounded-[18px] bg-[#f4f4f4]">
            <Image src={order.image} alt={order.title} fill sizes="92px" className="object-cover" />
          </div>
          <div className="min-w-0">
            <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#7b7b7b]">Commande</div>
            <div className="mt-1 break-all text-[15px] font-semibold text-[#222]">{order.id}</div>
            <div className="mt-2 line-clamp-2 text-[14px] leading-5 text-[#444]">{order.title}</div>
          </div>
        </div>

        <div className="mt-5 space-y-3 rounded-[20px] bg-[#fafafa] px-4 py-4 ring-1 ring-black/5">
          <div>
            <div className="text-[12px] text-[#777]">Vendeur</div>
            <div className="mt-1 text-[15px] font-semibold text-[#222]">{order.seller}</div>
          </div>
          <div>
            <div className="text-[12px] text-[#777]">Montant a payer</div>
            <div className="mt-1 text-[22px] font-bold tracking-[-0.04em] text-[#ea5c00]">{order.total}</div>
          </div>
        </div>
      </aside>
    </div>
  );
}
