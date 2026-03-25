"use client";

import Image from "next/image";
import Link from "next/link";
import { CreditCard, Landmark, Smartphone, WalletCards } from "lucide-react";
import { useEffect, useRef, useState } from "react";

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

const methods = [
  { key: "card", label: "Carte bancaire", icon: CreditCard, detail: "Visa, Mastercard et cartes compatibles Moneroo" },
  { key: "bank", label: "Virement bancaire", icon: Landmark, detail: "Methodes bancaires locales disponibles selon votre configuration" },
  { key: "mobile", label: "Mobile Money", icon: Smartphone, detail: "Paiement mobile pris en charge directement dans le checkout heberge" },
];

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

export function PaymentClient({ order }: PaymentClientProps) {
  const [selectedMethod, setSelectedMethod] = useState(methods[0].key);
  const [isPaid, setIsPaid] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState(order.kind === "sourcing" ? order.paymentStatus : "unpaid");
  const [promoCode, setPromoCode] = useState(order.kind === "sourcing" ? order.promoCode ?? "" : "");
  const [promoDiscountLabel, setPromoDiscountLabel] = useState(order.kind === "sourcing" ? order.promoDiscountLabel : undefined);
  const [displayTotal, setDisplayTotal] = useState(order.total);
  const [originalTotal, setOriginalTotal] = useState(order.kind === "sourcing" ? order.originalTotal : undefined);
  const [promoInput, setPromoInput] = useState("");
  const [monerooPaymentId, setMonerooPaymentId] = useState(order.kind === "sourcing" ? order.monerooPaymentId : undefined);
  const [monerooCheckoutUrl, setMonerooCheckoutUrl] = useState(order.kind === "sourcing" ? order.monerooCheckoutUrl : undefined);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isApplyingPromo, setIsApplyingPromo] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const verifiedPaymentIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (order.kind !== "sourcing" || !order.returnPaymentId) {
      return;
    }

    if (verifiedPaymentIdRef.current === order.returnPaymentId) {
      return;
    }

    verifiedPaymentIdRef.current = order.returnPaymentId;
    setFeedbackMessage(order.returnPaymentStatus ? `Retour Moneroo recu: ${order.returnPaymentStatus}. Verification en cours.` : "Verification du paiement Moneroo en cours.");
    setIsVerifying(true);

    void fetch("/api/payments/moneroo/verify", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        orderId: order.id,
        paymentId: order.returnPaymentId,
      }),
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.order) {
          throw new Error(payload?.message || "La verification Moneroo a echoue.");
        }

        setPaymentStatus(payload.order.paymentStatus);
        setMonerooPaymentId(payload.order.monerooPaymentId);
        setMonerooCheckoutUrl(payload.order.monerooCheckoutUrl);
        setFeedbackMessage(payload.order.paymentStatus === "paid" ? "Paiement confirme. La commande est maintenant marquee comme payee." : `Paiement verifie avec le statut ${payload.order.monerooPaymentStatus || payload.order.paymentStatus}.`);
      })
      .catch((error) => {
        setFeedbackMessage(error instanceof Error ? error.message : "La verification Moneroo a echoue.");
      })
      .finally(() => {
        setIsVerifying(false);
      });
  }, [order]);

  const initializeMonerooCheckout = async () => {
    if (order.kind !== "sourcing") {
      setIsPaid(true);
      return;
    }

    if (paymentStatus === "paid") {
      setFeedbackMessage("Cette commande est deja payee.");
      return;
    }

    setIsInitializing(true);
    setFeedbackMessage(null);

    try {
      const response = await fetch("/api/payments/moneroo/initialize", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ orderId: order.id }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.checkoutUrl) {
        throw new Error(payload?.message || "Impossible d'ouvrir le checkout Moneroo.");
      }

      setPaymentStatus(payload.order?.paymentStatus || "initialized");
      setMonerooPaymentId(payload.paymentId || payload.order?.monerooPaymentId);
      setMonerooCheckoutUrl(payload.checkoutUrl || payload.order?.monerooCheckoutUrl);
      window.location.href = payload.checkoutUrl;
    } catch (error) {
      setFeedbackMessage(error instanceof Error ? error.message : "Impossible d'ouvrir le checkout Moneroo.");
    } finally {
      setIsInitializing(false);
    }
  };

  const verifyCurrentPayment = async () => {
    if (order.kind !== "sourcing") {
      return;
    }

    const paymentId = monerooPaymentId || order.returnPaymentId;
    if (!paymentId) {
      setFeedbackMessage("Aucun paiement Moneroo n'est associe a cette commande pour le moment.");
      return;
    }

    setIsVerifying(true);
    setFeedbackMessage(null);

    try {
      const response = await fetch("/api/payments/moneroo/verify", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ orderId: order.id, paymentId }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.order) {
        throw new Error(payload?.message || "Impossible de verifier le paiement Moneroo.");
      }

      setPaymentStatus(payload.order.paymentStatus);
      setMonerooPaymentId(payload.order.monerooPaymentId);
      setMonerooCheckoutUrl(payload.order.monerooCheckoutUrl);
      setFeedbackMessage(payload.order.paymentStatus === "paid" ? "Paiement confirme par Moneroo." : `Dernier statut Moneroo: ${payload.order.monerooPaymentStatus || payload.order.paymentStatus}.`);
    } catch (error) {
      setFeedbackMessage(error instanceof Error ? error.message : "Impossible de verifier le paiement Moneroo.");
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
      const response = await fetch(`/api/alibaba-sourcing/orders/${encodeURIComponent(order.id)}/promo`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ code: promoInput }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.order) {
        throw new Error(payload?.message || "Impossible d'appliquer ce code promo.");
      }

      setPromoCode(payload.promoCode || promoInput.trim().toUpperCase());
      setPromoDiscountLabel(payload.promoDiscountLabel);
      setOriginalTotal(payload.originalTotal);
      setDisplayTotal(payload.total || order.total);
      setFeedbackMessage(`Code ${payload.promoCode} appliqué sur la commande.`);
    } catch (error) {
      setFeedbackMessage(error instanceof Error ? error.message : "Impossible d'appliquer ce code promo.");
    } finally {
      setIsApplyingPromo(false);
    }
  };

  if (order.kind === "sourcing") {
    const shippingLabel = order.shippingLabel || (order.shippingMethod === "sea" ? "Fret maritime groupe" : order.shippingMethod === "freight" ? "Fret local Chine" : "Fret aerien");
    const statusLabel = getPaymentStatusLabel(paymentStatus);
    const heading = order.heading || "Finaliser la commande sourcing";
    const description = order.description || `AfriPay initialise un checkout Moneroo securise pour encaisser la commande en ${order.paymentCurrency}. Une verification serveur est relancee au retour pour confirmer le statut reel.`;
    const badgeLabel = order.badgeLabel || "Paiement Moneroo";
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
            <div className="flex w-full items-start gap-3 rounded-[20px] border border-[#ffddb9] bg-[#fff6ee] px-4 py-4 text-left">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-white text-[#ff6a00] ring-1 ring-black/5">
                <WalletCards className="h-5 w-5" />
              </div>
              <div>
                <div className="text-[16px] font-semibold text-[#222]">Checkout heberge Moneroo</div>
                <div className="mt-1 text-[13px] leading-5 text-[#666]">Carte, mobile money et moyens locaux compatibles avec votre configuration Moneroo.</div>
              </div>
            </div>
            {methods.map((method) => {
              const Icon = method.icon;
              const isSelected = selectedMethod === method.key;

              return (
                <button
                  key={method.key}
                  type="button"
                  onClick={() => setSelectedMethod(method.key)}
                  className={[
                    "flex w-full items-start gap-3 rounded-[20px] border px-4 py-4 text-left transition",
                    isSelected ? "border-[#ff6a00] bg-[#fff5ed] shadow-[inset_0_0_0_1px_#ff6a00]" : "border-[#e5e5e5] bg-white hover:border-[#ffb48a]",
                  ].join(" ")}
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-white text-[#ff6a00] ring-1 ring-black/5">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-[16px] font-semibold text-[#222]">{method.label}</div>
                    <div className="mt-1 text-[13px] leading-5 text-[#666]">{method.detail}</div>
                  </div>
                </button>
              );
            })}
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
                  {promoCode ? "Déjà appliqué" : isApplyingPromo ? "Application..." : "Appliquer"}
                </button>
              </div>
            </div>
          ) : null}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={initializeMonerooCheckout}
              disabled={isInitializing || isVerifying || isApplyingPromo || paymentStatus === "paid"}
              className="inline-flex h-12 items-center justify-center rounded-full bg-[#ea5c00] px-6 text-[15px] font-semibold text-white transition hover:bg-[#d85400] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {paymentStatus === "paid" ? "Commande payee" : isInitializing ? "Ouverture du checkout..." : paymentStatus === "initialized" || paymentStatus === "pending" ? "Reprendre le paiement" : "Payer avec Moneroo"}
            </button>
            <button
              type="button"
              onClick={verifyCurrentPayment}
              disabled={isInitializing || isVerifying || !monerooPaymentId}
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
                {originalTotal ? <div className="mt-1 text-[12px] text-[#667085]">Avant réduction: {originalTotal}</div> : null}
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
                <div className="text-[12px] text-[#777]">Créateur du panier tiers</div>
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
              <div className="text-[12px] text-[#777]">Paiement Moneroo</div>
              <div className="mt-1 break-all text-[15px] font-semibold text-[#222]">{monerooPaymentId || "Pas encore initialise"}</div>
            </div>
            {monerooCheckoutUrl ? (
              <Link href={monerooCheckoutUrl} className="inline-flex text-[13px] font-semibold text-[#ea5c00] transition hover:text-[#c94d00]">
                Reouvrir le checkout Moneroo
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
          Choisissez votre moyen de paiement pour valider la commande et lancer le traitement AfriPay.
        </p>

        {isPaid ? (
          <div className="mt-5 rounded-[18px] border border-[#c8ead1] bg-[#effbf2] px-4 py-4 text-[14px] font-medium text-[#1f7a39]">
            Paiement initié avec succès pour {order.id}. La commande sera mise à jour après validation.
          </div>
        ) : null}

        <div className="mt-6 space-y-3">
          {methods.map((method) => {
            const Icon = method.icon;
            const isSelected = selectedMethod === method.key;

            return (
              <button
                key={method.key}
                type="button"
                onClick={() => setSelectedMethod(method.key)}
                className={[
                  "flex w-full items-start gap-3 rounded-[20px] border px-4 py-4 text-left transition",
                  isSelected ? "border-[#ff6a00] bg-[#fff5ed] shadow-[inset_0_0_0_1px_#ff6a00]" : "border-[#e5e5e5] bg-white hover:border-[#ffb48a]",
                ].join(" ")}
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-white text-[#ff6a00] ring-1 ring-black/5">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[16px] font-semibold text-[#222]">{method.label}</div>
                  <div className="mt-1 text-[13px] leading-5 text-[#666]">{method.detail}</div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => setIsPaid(true)}
            className="inline-flex h-12 items-center justify-center rounded-full bg-[#ea5c00] px-6 text-[15px] font-semibold text-white transition hover:bg-[#d85400]"
          >
            Confirmer le paiement
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
            <div className="text-[12px] text-[#777]">Montant à payer</div>
            <div className="mt-1 text-[22px] font-bold tracking-[-0.04em] text-[#ea5c00]">{order.total}</div>
          </div>
        </div>
      </aside>
    </div>
  );
}