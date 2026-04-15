"use client";

import Image from "next/image";
import Link from "next/link";
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  CreditCard,
  FileText,
  MapPin,
  MessageCircle,
  ReceiptText,
  Search,
  Send,
  ShieldCheck,
  Star,
  TicketPercent,
  Truck,
  UserCheck,
  Volume2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getOrderChatHref, getOrderConfirmReceiptHref, getOrderDeliveryProofHref, getOrderPaymentHref, getOrderTabs, getOrderTrackingHref, sidebarItems, type OrderRecord, type OrderTabKey } from "@/lib/orders-data";
import { initializeOrderPayment, verifyOrderPayment, type PaymentProvider } from "@/lib/api";

type SidebarItemKey = (typeof sidebarItems)[number];

type OrdersClientProps = {
  orders: OrderRecord[];
  languageCode: string;
  paymentAction?: {
    orderId?: string;
    paymentId?: string;
    paymentStatus?: string;
    payOrderId?: string;
    payment?: string;
    provider?: string;
  };
};

function normalizePaymentProvider(input?: string | null): PaymentProvider {
  return input === "paypal" ? "paypal" : "moneroo";
}

function getPaymentProviderLabel(provider: PaymentProvider) {
  return provider === "paypal" ? "PayPal" : "Moneroo";
}

const sidebarItemMeta = {
  "Toutes les commandes": { label: "Commandes", icon: ClipboardList },
  "Remboursements et apres-vente": { label: "SAV", icon: ReceiptText },
  Avis: { label: "Avis", icon: Star },
  "Coupons et credits": { label: "Credits", icon: TicketPercent },
  "Informations fiscales": { label: "Fiscal", icon: CircleDollarSign },
} as const;

const orderTabMeta = {
  all: { shortLabel: "Toutes", icon: ClipboardList },
  "payment-pending": { shortLabel: "Paiement", icon: CreditCard },
  "shipment-pending": { shortLabel: "Expedition", icon: Truck },
  "delivery-pending": { shortLabel: "Livraison", icon: Truck },
  delivered: { shortLabel: "Livre", icon: ReceiptText },
} as const satisfies Record<OrderTabKey, { shortLabel: string; icon: typeof ClipboardList }>;

function getOrderActions(order: OrderRecord) {
  if (order.status === "Paiement en attente") {
    return {
      primaryLabel: "Payer maintenant",
      primaryHref: getOrderPaymentHref(order),
      secondaryLabel: "Soumettre une preuve de virement",
      secondaryHref: `/orders/remittance-proof?orderId=${encodeURIComponent(order.id)}`,
    };
  }

  if (order.status === "Expedition en attente") {
    return {
      primaryLabel: "Suivre l'expedition",
      primaryHref: getOrderTrackingHref(order),
      secondaryLabel: null,
      secondaryHref: null,
    };
  }

  if (order.status === "Livraison en attente") {
    return {
      primaryLabel: "Suivre la livraison",
      primaryHref: getOrderTrackingHref(order),
      secondaryLabel: "Confirmer la reception",
      secondaryHref: getOrderConfirmReceiptHref(order),
    };
  }

  return {
    primaryLabel: "Voir la preuve de livraison",
    primaryHref: getOrderDeliveryProofHref(order),
    secondaryLabel: null,
    secondaryHref: null,
  };
}

function getMobilePrimaryLabel(label: string) {
  if (label === "Payer maintenant") {
    return "Payer";
  }

  if (label === "Suivre l'expedition") {
    return "Suivre";
  }

  if (label === "Suivre la livraison") {
    return "Livraison";
  }

  if (label === "Voir la preuve de livraison") {
    return "Preuve";
  }

  return label;
}

function getMobileSecondaryLabel(label: string) {
  if (label === "Soumettre une preuve de virement") {
    return "Preuve";
  }

  if (label === "Voir les details de la commande") {
    return "Details";
  }

  if (label === "Confirmer la reception") {
    return "Reception";
  }

  return label;
}

function getMobileCorridorLabel(label: string) {
  return label
    .replace("Fournisseur", "Depart")
    .replace("Chine", "Hub AfriPay")
    .replace("France", "Destination")
    .replace("Togo", "Destination")
    .replace("Ghana", "Destination")
    .replace("Cote d'Ivoire", "Destination")
    .replace(" -> ", " > ");
}

function formatDateTimeLabel(value?: string) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("fr-FR");
}

function isMissingSourcingOrderError(message: string | null | undefined) {
  const normalized = String(message ?? "").trim().toLowerCase();
  return normalized === "commande sourcing introuvable." || normalized === "commande sourcing introuvable";
}

function getSectionTitle(activeSidebarItem: SidebarItemKey) {
  if (activeSidebarItem === "Remboursements et apres-vente") {
    return "Remboursements et apres-vente";
  }

  if (activeSidebarItem === "Avis") {
    return "Avis commandes";
  }

  if (activeSidebarItem === "Coupons et credits") {
    return "Coupons et credits";
  }

  if (activeSidebarItem === "Informations fiscales") {
    return "Informations fiscales";
  }

  return "Vos commandes";
}

function OrdersSidePanel({
  activeSidebarItem,
  orders,
  refundRequests,
  reviewedOrders,
  onRefundRequest,
  onReviewOrder,
}: {
  activeSidebarItem: SidebarItemKey;
  orders: OrderRecord[];
  refundRequests: Record<string, "in_review" | "accepted" | "credited">;
  reviewedOrders: Record<string, boolean>;
  onRefundRequest: (orderId: string) => void;
  onReviewOrder: (orderId: string) => void;
}) {
  const deliveredOrders = orders.filter((order) => order.tab === "delivered");
  const pendingReviewOrders = deliveredOrders.filter((order) => !reviewedOrders[order.id]);
  const usedCoupons = orders.filter((order) => order.promoCode);
  const creditedRefunds = Object.entries(refundRequests).filter(([, status]) => status === "credited");
  const requestedRefundOrders = orders.filter((order) => refundRequests[order.id]);

  if (activeSidebarItem === "Remboursements et apres-vente") {
    return (
      <div className="mt-6 space-y-4">
        <div className="rounded-[18px] bg-[#fff7f1] px-5 py-5 text-[14px] leading-6 text-[#6b3a12] ring-1 ring-[#f3d7bf]">
          Une commande deja passee ne peut pas etre annulee. Le retour devient possible apres reception si l'article n'est pas conforme aux photos ou a la fiche produit. Dans ce cas, le retour est gratuit, le dossier passe en examen, puis l'admin peut l'accepter et indiquer l'adresse de retour.
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-[18px] bg-white px-5 py-5 ring-1 ring-[#e7e7e7]">
            <div className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[#888]">En examen</div>
            <div className="mt-2 text-[28px] font-black text-[#222]">{Object.values(refundRequests).filter((status) => status === "in_review").length}</div>
          </div>
          <div className="rounded-[18px] bg-white px-5 py-5 ring-1 ring-[#e7e7e7]">
            <div className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[#888]">Acceptes</div>
            <div className="mt-2 text-[28px] font-black text-[#222]">{Object.values(refundRequests).filter((status) => status === "accepted").length}</div>
          </div>
          <div className="rounded-[18px] bg-white px-5 py-5 ring-1 ring-[#e7e7e7]">
            <div className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[#888]">Credits client</div>
            <div className="mt-2 text-[28px] font-black text-[#222]">{creditedRefunds.length}</div>
          </div>
        </div>

        <div className="space-y-3">
          {deliveredOrders.length === 0 ? (
            <div className="rounded-[18px] bg-[#fafafa] px-5 py-7 text-[14px] leading-6 text-[#666] ring-1 ring-black/5">
              Aucun article recu pour le moment. Les demandes de remboursement s'ouvrent apres reception, pour un article non conforme.
            </div>
          ) : null}

          {deliveredOrders.map((order) => {
            const status = refundRequests[order.id];
            const label = status === "credited"
              ? "Client credite"
              : status === "accepted"
                ? "Remboursement accepte - retour attendu"
                : status === "in_review"
                  ? "Dossier en examen"
                  : "Demander un remboursement";

            return (
              <div key={order.id} className="flex flex-col gap-4 rounded-[18px] bg-white px-5 py-5 ring-1 ring-[#e7e7e7] lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="text-[15px] font-bold text-[#222]">{order.orderNumber}</div>
                  <div className="mt-1 text-[13px] leading-5 text-[#666]">{order.title}</div>
                  {status ? <div className="mt-2 text-[12px] font-semibold text-[#b55420]">{label}</div> : null}
                </div>
                <button type="button" onClick={() => onRefundRequest(order.id)} disabled={Boolean(status)} className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#ea5c00] px-5 text-[13px] font-semibold text-white transition hover:bg-[#d85400] disabled:bg-[#d9d9d9] disabled:text-[#777]">
                  <Send className="h-4 w-4" />
                  {label}
                </button>
              </div>
            );
          })}

          {requestedRefundOrders.length ? (
            <div className="rounded-[18px] bg-[#f6f7f9] px-5 py-5 text-[13px] leading-6 text-[#555] ring-1 ring-black/5">
              Cote admin, ces dossiers doivent etre analyses, puis acceptes avec une adresse de retour. Le credit client s'affiche ici apres acceptation et reception de l'article retourne.
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  if (activeSidebarItem === "Avis") {
    return (
      <div className="mt-6 space-y-4">
        <div className="rounded-[18px] bg-[#fff7f1] px-5 py-5 text-[14px] leading-6 text-[#6b3a12] ring-1 ring-[#f3d7bf]">
          Apres reception, l'avis est obligatoire pour chaque commande. Chaque avis reste lie a sa commande et aide l'equipe a controler la qualite produit.
        </div>
        {deliveredOrders.length === 0 ? (
          <div className="rounded-[18px] bg-[#fafafa] px-5 py-7 text-[14px] text-[#666] ring-1 ring-black/5">Aucune commande livree en attente d'avis.</div>
        ) : null}
        {deliveredOrders.map((order) => (
          <div key={order.id} className="flex flex-col gap-4 rounded-[18px] bg-white px-5 py-5 ring-1 ring-[#e7e7e7] lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-[15px] font-bold text-[#222]">{order.orderNumber}</div>
              <div className="mt-1 text-[13px] leading-5 text-[#666]">{order.title}</div>
              <div className="mt-2 text-[12px] font-semibold text-[#b55420]">{reviewedOrders[order.id] ? "Avis recu" : "Avis obligatoire a completer"}</div>
            </div>
            <button type="button" onClick={() => onReviewOrder(order.id)} disabled={Boolean(reviewedOrders[order.id])} className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#222] px-5 text-[13px] font-semibold text-white transition hover:bg-[#333] disabled:bg-[#d9d9d9] disabled:text-[#777]">
              <Star className="h-4 w-4" />
              {reviewedOrders[order.id] ? "Avis envoye" : "Laisser un avis"}
            </button>
          </div>
        ))}
        {pendingReviewOrders.length ? <div className="text-[13px] font-semibold text-[#b55420]">{pendingReviewOrders.length} avis obligatoire(s) restant(s).</div> : null}
      </div>
    );
  }

  if (activeSidebarItem === "Coupons et credits") {
    return (
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-[18px] bg-white px-5 py-5 ring-1 ring-[#e7e7e7]">
          <div className="flex items-center gap-2 text-[16px] font-bold text-[#222]"><TicketPercent className="h-5 w-5" /> Coupons</div>
          <div className="mt-4 space-y-3">
            {usedCoupons.length === 0 ? <div className="text-[14px] leading-6 text-[#666]">Les coupons crees dans l'admin apparaitront ici quand ils seront disponibles pour ce compte.</div> : null}
            {usedCoupons.map((order) => (
              <div key={`${order.id}-${order.promoCode}`} className="rounded-[16px] bg-[#fff7f1] px-4 py-3 text-[13px] text-[#6b3a12]">
                <span className="font-bold">{order.promoCode}</span> utilise sur {order.orderNumber} · {order.promoDiscountLabel}
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-[18px] bg-white px-5 py-5 ring-1 ring-[#e7e7e7]">
          <div className="flex items-center gap-2 text-[16px] font-bold text-[#222]"><CheckCircle2 className="h-5 w-5" /> Credits client</div>
          <div className="mt-4 space-y-3">
            {creditedRefunds.length === 0 ? <div className="text-[14px] leading-6 text-[#666]">Les credits de remboursement acceptes s'afficheront ici.</div> : null}
            {creditedRefunds.map(([orderId]) => (
              <div key={orderId} className="rounded-[16px] bg-[#effbf2] px-4 py-3 text-[13px] font-semibold text-[#1f7a39]">
                Credit remboursement disponible pour la commande {orders.find((order) => order.id === orderId)?.orderNumber ?? orderId}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (activeSidebarItem === "Informations fiscales") {
    return (
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-[18px] bg-white px-5 py-5 ring-1 ring-[#e7e7e7]">
          <div className="flex items-center gap-2 text-[16px] font-bold text-[#222]"><FileText className="h-5 w-5" /> Profil fiscal</div>
          <p className="mt-3 text-[14px] leading-6 text-[#666]">Un client entrepreneur ou entreprise peut renseigner son numero fiscal, sa raison sociale et son adresse de facturation pour recevoir des propositions de reduction et de partenariat.</p>
          <Link href="/account/compte/informations-fiscales" className="mt-5 inline-flex h-11 items-center justify-center rounded-full bg-[#222] px-5 text-[13px] font-semibold text-white transition hover:bg-[#333]">
            Completer mes informations
          </Link>
        </div>
        <div className="rounded-[18px] bg-[#fff7f1] px-5 py-5 text-[#6b3a12] ring-1 ring-[#f3d7bf]">
          <div className="flex items-center gap-2 text-[16px] font-bold"><UserCheck className="h-5 w-5" /> Avantages entreprise</div>
          <div className="mt-4 space-y-2 text-[14px] leading-6">
            <div>Reductions sur les commandes regulieres.</div>
            <div>Propositions de partenariat AfriPay.</div>
            <div>Suivi fiscal et facturation plus claire.</div>
          </div>
          <Link href="/partnership" className="mt-5 inline-flex h-11 items-center justify-center rounded-full border border-[#6b3a12] px-5 text-[13px] font-semibold transition hover:bg-white">
            Voir le partenariat
          </Link>
        </div>
      </div>
    );
  }

  return null;
}

export function OrdersClient({ orders, languageCode, paymentAction }: OrdersClientProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDate, setSelectedDate] = useState("all");
  const [selectedTime, setSelectedTime] = useState("all");
  const [activeTab, setActiveTab] = useState<OrderTabKey>("all");
  const [activeSidebarItem, setActiveSidebarItem] = useState<SidebarItemKey>("Toutes les commandes");
  const [refundRequests, setRefundRequests] = useState<Record<string, "in_review" | "accepted" | "credited">>({});
  const [reviewedOrders, setReviewedOrders] = useState<Record<string, boolean>>({});
  const isEnglish = languageCode === "en";
  const [paymentFeedback, setPaymentFeedback] = useState<string | null>(() => {
    if (paymentAction?.payment?.trim() !== "initialization_failed") {
      return null;
    }

    const provider = normalizePaymentProvider(paymentAction?.provider?.trim());
    const providerLabel = getPaymentProviderLabel(provider);
    return isEnglish
      ? `The order was created, but ${providerLabel} could not be opened automatically. Please try again from your order.`
      : `La commande a ete creee, mais ${providerLabel} n'a pas pu s'ouvrir automatiquement. Relancez le paiement depuis votre commande.`;
  });
  const [isPaymentBusy, setIsPaymentBusy] = useState(false);
  const handledPaymentActionRef = useRef<string | null>(null);

  const dateOptions = useMemo(() => [
    { value: "all", label: "Date de la commande" },
    ...Array.from(new Map(orders.map((order) => [order.dateValue, order.dateLabel])).entries()).map(([value, label]) => ({
      value,
      label,
    })),
  ], [orders]);

  const timeOptions = useMemo(() => [
    { value: "all", label: "Selectionner l'heure" },
    ...Array.from(new Set(orders.map((order) => order.timeValue))).map((value) => ({
      value,
      label: value,
    })),
  ], [orders]);

  const orderTabs = useMemo(() => getOrderTabs(orders), [orders]);
  const pendingProofDefaultOrder = useMemo(() => orders.find((order) => order.status === "Paiement en attente") ?? orders[0] ?? null, [orders]);

  useEffect(() => {
    const refundRaw = window.localStorage.getItem("afripay-order-refunds");
    const reviewRaw = window.localStorage.getItem("afripay-order-reviews");

    if (refundRaw) {
      try {
        setRefundRequests(JSON.parse(refundRaw) as Record<string, "in_review" | "accepted" | "credited">);
      } catch {
        setRefundRequests({});
      }
    }

    if (reviewRaw) {
      try {
        setReviewedOrders(JSON.parse(reviewRaw) as Record<string, boolean>);
      } catch {
        setReviewedOrders({});
      }
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("afripay-order-refunds", JSON.stringify(refundRequests));
  }, [refundRequests]);

  useEffect(() => {
    window.localStorage.setItem("afripay-order-reviews", JSON.stringify(reviewedOrders));
  }, [reviewedOrders]);

  useEffect(() => {
    const payOrderId = paymentAction?.payOrderId?.trim() || (
      paymentAction?.payment?.trim() === "initialization_failed"
        ? paymentAction?.orderId?.trim()
        : undefined
    );
    const orderId = paymentAction?.orderId?.trim();
    const paymentId = paymentAction?.paymentId?.trim();
    const paymentStatus = paymentAction?.paymentStatus?.trim();
    const payment = paymentAction?.payment?.trim();
    const provider = normalizePaymentProvider(paymentAction?.provider?.trim());
    const providerLabel = getPaymentProviderLabel(provider);
    const actionKey = [payOrderId ?? "", orderId ?? "", paymentId ?? "", paymentStatus ?? "", payment ?? "", provider].join("|");

    if (!actionKey.replace(/\|/g, "")) {
      return;
    }

    if (handledPaymentActionRef.current === actionKey) {
      return;
    }

    handledPaymentActionRef.current = actionKey;

    if (payOrderId) {
      const timeoutId = window.setTimeout(() => {
        setIsPaymentBusy(true);
        setPaymentFeedback(payment === "initialization_failed"
          ? (isEnglish ? `Retrying ${providerLabel} checkout...` : `Nouvelle tentative d'ouverture du checkout ${providerLabel}...`)
          : (isEnglish ? `Opening ${providerLabel} checkout...` : `Ouverture du checkout ${providerLabel}...`));

        void initializeOrderPayment(payOrderId, provider)
          .then((payload) => {
            if (!payload?.checkoutUrl) {
              throw new Error(isEnglish ? `Unable to open ${providerLabel} checkout.` : `Impossible d'ouvrir le checkout ${providerLabel}.`);
            }

            window.location.href = payload.checkoutUrl;
          })
          .catch((error) => {
            setPaymentFeedback(error instanceof Error ? error.message : isEnglish ? `Unable to open ${providerLabel} checkout.` : `Impossible d'ouvrir le checkout ${providerLabel}.`);
          })
          .finally(() => {
            setIsPaymentBusy(false);
          });
      }, 0);

      return () => {
        window.clearTimeout(timeoutId);
      };
    }

    if (orderId) {
      const timeoutId = window.setTimeout(() => {
        setIsPaymentBusy(true);
        setPaymentFeedback(paymentStatus
          ? (isEnglish ? `${providerLabel} return received: ${paymentStatus}. Verifying payment...` : `Retour ${providerLabel} recu: ${paymentStatus}. Verification du paiement en cours...`)
          : (isEnglish ? `Verifying ${providerLabel} payment...` : `Verification du paiement ${providerLabel} en cours...`));

        void verifyOrderPayment(orderId, paymentId, provider)
          .then((payload) => {
            setPaymentFeedback(payload.order.paymentStatus === "paid"
              ? (isEnglish ? "Payment confirmed. Your order is now marked as paid." : "Paiement confirme. Votre commande est maintenant marquee comme payee.")
              : (isEnglish
                  ? `Latest ${providerLabel} status: ${payload.order.paymentProviderStatus || payload.order.monerooPaymentStatus || payload.order.paymentStatus}.`
                  : `Dernier statut ${providerLabel}: ${payload.order.paymentProviderStatus || payload.order.monerooPaymentStatus || payload.order.paymentStatus}.`));
            router.refresh();
          })
          .catch((error) => {
            const message = error instanceof Error ? error.message : undefined;
            if (isMissingSourcingOrderError(message)) {
              setPaymentFeedback(null);
              router.replace("/orders");
              return;
            }

            setPaymentFeedback(message || (isEnglish ? `Unable to verify ${providerLabel} payment.` : `Impossible de verifier le paiement ${providerLabel}.`));
          })
          .finally(() => {
            setIsPaymentBusy(false);
          });
      }, 0);

      return () => {
        window.clearTimeout(timeoutId);
      };
    }
  }, [isEnglish, paymentAction, router]);

  const filteredOrders = useMemo(() => {
    const normalizedQuery = searchTerm.trim().toLowerCase();

    return orders.filter((order) => {
      const matchesSearch =
        !normalizedQuery ||
        `${order.id} ${order.orderNumber} ${order.title} ${order.variant} ${order.seller}`.toLowerCase().includes(normalizedQuery);
      const matchesDate = selectedDate === "all" || order.dateValue === selectedDate;
      const matchesTime = selectedTime === "all" || order.timeValue === selectedTime;
      const matchesTab = activeTab === "all" || order.tab === activeTab;

      return matchesSearch && matchesDate && matchesTime && matchesTab;
    });
  }, [activeTab, orders, searchTerm, selectedDate, selectedTime]);

  const handleRefundRequest = (orderId: string) => {
    setRefundRequests((current) => ({
      ...current,
      [orderId]: current[orderId] ?? "in_review",
    }));
  };

  const handleReviewOrder = (orderId: string) => {
    setReviewedOrders((current) => ({
      ...current,
      [orderId]: true,
    }));
  };

  if (orders.length === 0) {
    return (
      <div className="rounded-[24px] bg-white px-6 py-8 shadow-[0_8px_30px_rgba(24,39,75,0.05)] ring-1 ring-black/5">
        <h1 className="text-[24px] font-bold tracking-[-0.05em] text-[#222] sm:text-[30px]">Vos commandes</h1>
        <p className="mt-3 text-[14px] leading-6 text-[#666]">Aucune commande liee a votre compte pour le moment. Finalisez un checkout sourcing pour voir votre suivi ici.</p>
        <Link href="/checkout" className="mt-5 inline-flex h-11 items-center justify-center rounded-full bg-[#ea5c00] px-5 text-[14px] font-semibold text-white transition hover:bg-[#d85400]">
          Commencer un checkout
        </Link>
      </div>
    );
  }

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[240px_minmax(0,1fr)] xl:gap-6">
      <aside className="hidden self-start overflow-x-auto rounded-[22px] bg-[#f1f3f7] px-4 py-4 xl:sticky xl:top-8 xl:block xl:px-5 xl:py-6">
        <h2 className="text-[15px] font-semibold text-[#222]">Commandes</h2>
        <div className="mt-4 flex gap-2 text-[14px] text-[#333] xl:block xl:space-y-2">
          {sidebarItems.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setActiveSidebarItem(item)}
              className={["w-full shrink-0 rounded-[14px] px-4 py-2.5 text-left leading-5 transition hover:bg-white", activeSidebarItem === item ? "bg-white font-semibold" : "bg-white/60 xl:bg-transparent"].join(" ")}
            >
              {item}
            </button>
          ))}
        </div>
      </aside>

      <section className="min-w-0 bg-transparent px-0 py-0 shadow-none ring-0 sm:rounded-[28px] sm:bg-white sm:px-6 sm:py-6 sm:shadow-[0_8px_30px_rgba(24,39,75,0.05)] sm:ring-1 sm:ring-black/5 lg:px-7 lg:py-7">
        <div className="mb-4 xl:hidden">
          <div className="rounded-[20px] bg-[#f1f3f7] px-3 py-3">
            <div className="text-[15px] font-semibold text-[#222]">Commandes</div>
            <div className="mt-3 flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {sidebarItems.map((item) => {
                const meta = sidebarItemMeta[item as keyof typeof sidebarItemMeta];
                const Icon = meta.icon;

                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setActiveSidebarItem(item)}
                    className={[
                      "flex shrink-0 items-center gap-2 rounded-[14px] px-3 py-2.5 text-[12px] font-semibold",
                      activeSidebarItem === item ? "bg-white text-[#222] shadow-[0_6px_18px_rgba(17,24,39,0.06)]" : "bg-white/70 text-[#4a4a4a]",
                    ].join(" ")}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="whitespace-nowrap">{meta.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <h1 className="text-[20px] font-bold tracking-[-0.05em] text-[#222] sm:text-[28px] lg:text-[36px]">{getSectionTitle(activeSidebarItem)}</h1>
          <Link href={`/orders/remittance-proof?orderId=${encodeURIComponent(pendingProofDefaultOrder?.id ?? orders[0].id)}`} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full border border-[#222] px-3 text-[12px] font-semibold text-[#222] transition hover:border-[#ff6a00] hover:text-[#ff6a00] sm:h-11 sm:w-auto sm:px-6 sm:text-[14px]">
            <CreditCard className="h-4 w-4" />
            <span className="sm:hidden">Preuve</span>
            <span className="hidden sm:inline">Soumettre une preuve de virement</span>
          </Link>
        </div>

        {paymentFeedback ? (
          <div className={["mt-4 rounded-[16px] px-4 py-3 text-[13px] font-medium sm:text-[14px]", isPaymentBusy ? "bg-[#eef6ff] text-[#1d4f91] ring-1 ring-[#d8e5fb]" : "bg-[#fff7f1] text-[#8a4b16] ring-1 ring-[#f3d7bf]"].join(" ")}>
            {paymentFeedback}
          </div>
        ) : null}

        {activeSidebarItem === "Toutes les commandes" ? (
        <>
        <div className="mt-5 flex gap-2.5 overflow-x-auto border-b border-[#e7e7e7] pb-1 text-[12px] text-[#333] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:gap-x-7 sm:gap-y-3 sm:overflow-visible sm:pb-0 sm:text-[14px]">
          {orderTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={[
                "flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-1 pb-3 text-left transition sm:gap-2 sm:px-1.5",
                activeTab === tab.key ? "border-[#222] font-semibold text-[#222]" : "border-transparent hover:text-[#222]",
              ].join(" ")}
            >
              {(() => {
                const meta = orderTabMeta[tab.key];
                const Icon = meta.icon;

                return (
                  <>
                    <Icon className="h-4 w-4 sm:hidden" />
                    <span className="sm:hidden">{meta.shortLabel}</span>
                    <span className="hidden sm:inline">{tab.label}</span>
                  </>
                );
              })()}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-2.5 lg:grid-cols-[1.1fr_0.52fr_0.52fr] sm:gap-3">
          <label className="flex h-10 items-center gap-2.5 rounded-[14px] border border-[#dfe3eb] bg-white px-3.5 text-[#888] focus-within:border-[#ff6a00] sm:h-12 sm:gap-3 sm:px-4">
            <Search className="h-4 w-4" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="flex-1 bg-transparent text-[13px] text-[#333] outline-none placeholder:text-[#999] sm:text-[14px]"
              placeholder="Commande ou produit"
            />
          </label>

          <label className="relative flex h-10 items-center rounded-[14px] border border-[#dfe3eb] bg-white px-3.5 focus-within:border-[#ff6a00] sm:h-12 sm:px-4">
            <select
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="h-full w-full appearance-none bg-transparent pr-8 text-[13px] text-[#333] outline-none sm:text-[14px]"
            >
              {dateOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-4 h-4 w-4 text-[#666]" />
          </label>

          <label className="relative flex h-10 items-center rounded-[14px] border border-[#dfe3eb] bg-white px-3.5 focus-within:border-[#ff6a00] sm:h-12 sm:px-4">
            <select
              value={selectedTime}
              onChange={(event) => setSelectedTime(event.target.value)}
              className="h-full w-full appearance-none bg-transparent pr-8 text-[13px] text-[#333] outline-none sm:text-[14px]"
            >
              {timeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <CalendarDays className="pointer-events-none absolute right-4 h-4 w-4 text-[#666]" />
          </label>
        </div>

        <div className="mt-4 flex items-start gap-3 rounded-[16px] bg-[#fafafa] px-4 py-3 text-[12px] text-[#333] ring-1 ring-black/5 sm:mt-5 sm:items-center sm:text-[13px]">
          <Volume2 className="mt-0.5 h-4 w-4 shrink-0 text-[#222] sm:mt-0" />
          <div className="min-w-0">
            <span>Virement protege par AfriPay.</span>{" "}
            <span className="font-semibold text-[#2b67f6]">Voir</span>
          </div>
        </div>

        <div className="mt-6 space-y-5">
          {filteredOrders.length === 0 ? (
            <div className="rounded-[18px] bg-[#fafafa] px-5 py-8 text-center text-[14px] text-[#666] ring-1 ring-black/5">
              Aucune commande ne correspond a votre recherche, date ou heure selectionnee.
            </div>
          ) : null}

          {filteredOrders.map((order) => (
            <article key={order.id} className="min-w-0 overflow-hidden rounded-[18px] border border-[#e7e7e7] bg-white shadow-[0_8px_22px_rgba(24,39,75,0.04)]">
              <div className="border-b border-[#efefef] bg-[#fbfbfb] px-4 py-4 text-[13px] text-[#333] sm:grid sm:grid-cols-2 sm:gap-4 sm:px-5 xl:grid-cols-[1.2fr_1fr_0.8fr_1.5fr_0.7fr]">
                <div className="flex min-w-0 items-start justify-between gap-3 sm:hidden">
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#7b7b7b]">Commande</div>
                    <div className="mt-1 break-all text-[13px] font-semibold leading-5 text-[#222]">{order.id}</div>
                  </div>
                  <Link href={getOrderChatHref(order)} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#222] ring-1 ring-black/5">
                    <MessageCircle className="h-4 w-4" />
                  </Link>
                </div>

                <div className="mt-3.5 grid grid-cols-2 gap-3 text-[11px] sm:hidden">
                  <div>
                    <div className="font-semibold text-[#222]">Date</div>
                    <div className="mt-1 line-clamp-2 text-[#4a4a4a]">{order.dateLabel}</div>
                  </div>
                  <div>
                    <div className="font-semibold text-[#222]">Total</div>
                    <div className="mt-1 text-[#4a4a4a]">{order.total}</div>
                  </div>
                  <div className="col-span-2">
                    <div className="font-semibold text-[#222]">Vendeur</div>
                    <div className="mt-1 line-clamp-1 text-[#4a4a4a]">{order.seller}</div>
                  </div>
                </div>

                <div className="hidden sm:block">
                <div>
                  <div className="font-semibold text-[#222]">Commande</div>
                  <div className="mt-1 text-[13px] text-[#4a4a4a]">{order.id}</div>
                </div>
                </div>
                <div className="hidden sm:block">
                  <div className="font-semibold text-[#222]">Date de commande :</div>
                  <div className="mt-1 text-[13px] text-[#4a4a4a]">{order.dateLabel}</div>
                </div>
                <div className="hidden sm:block">
                  <div className="font-semibold text-[#222]">Total :</div>
                  <div className="mt-1 text-[13px] text-[#4a4a4a]">{order.total}</div>
                </div>
                <div className="hidden sm:block">
                  <div className="font-semibold text-[#222]">Vendu par</div>
                  <div className="mt-1 line-clamp-1 text-[13px] text-[#4a4a4a]">{order.seller}</div>
                </div>
                <Link href={getOrderChatHref(order)} className="hidden text-left text-[13px] text-[#2a2a2a] underline transition hover:text-[#ff6a00] sm:block sm:col-span-2 xl:col-span-1 xl:text-right">
                  Discuter en ligne
                </Link>
              </div>

              <div className="grid gap-4 px-4 py-4 sm:gap-5 sm:px-5 sm:py-5 xl:grid-cols-[1fr_250px] xl:items-center">
                <div>
                  <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                    <div className="text-[16px] font-semibold tracking-[-0.04em] text-[#222] sm:text-[24px]">{order.status}</div>
                    <div className="inline-flex w-fit max-w-full items-center gap-1 rounded-full bg-[#fff4ec] px-2 py-1 text-[10px] font-semibold text-[#b55420] ring-1 ring-[#ffd8bc] sm:hidden">
                      <Truck className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{order.logistics.agentName}</span>
                    </div>
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-1.5 text-[10px] font-medium text-[#5d5148] sm:mt-3 sm:gap-2 sm:text-[12px]">
                    <span className="hidden rounded-full bg-[#fff4ec] px-3 py-1.5 ring-1 ring-[#ffd8bc] sm:inline-flex">Agent: {order.logistics.agentName}</span>
                    <span className="max-w-full rounded-full bg-[#f6f7f9] px-2.5 py-1 ring-1 ring-black/5 sm:px-3 sm:py-1.5">
                      <span className="sm:hidden">{getMobileCorridorLabel(order.logistics.corridorLabel)}</span>
                      <span className="hidden sm:inline">Corridor: {order.logistics.corridorLabel}</span>
                    </span>
                    <span className="max-w-full rounded-full bg-[#f6f7f9] px-2.5 py-1 ring-1 ring-black/5 sm:px-3 sm:py-1.5">
                      <span className="block max-w-[170px] truncate sm:max-w-none">{order.logistics.trackingCode ?? "Tracking en attente"}</span>
                    </span>
                  </div>
                  <div className="mt-3.5 flex gap-3 sm:mt-5 sm:flex-row sm:gap-4">
                    <div className="relative h-[70px] w-[70px] shrink-0 overflow-hidden rounded-[14px] bg-[#f4f4f4] sm:h-[92px] sm:w-[92px]">
                      <Image src={order.image} alt={order.title} fill sizes="92px" className="object-cover" />
                    </div>
                    <div className="max-w-[740px] min-w-0">
                      <div className="line-clamp-2 text-[13px] leading-5 text-[#222] sm:text-[16px] sm:leading-6">{order.title}</div>
                      <div className="mt-1 line-clamp-1 text-[11px] text-[#666] sm:mt-2 sm:line-clamp-2 sm:text-[14px]">{order.variant}</div>
                      {order.thirdPartyCartNotice ? <div className="mt-2 inline-flex items-center rounded-full bg-[#eef6ff] px-3 py-1 text-[10px] font-semibold text-[#1d4f91] sm:text-[12px]">{order.thirdPartyCartNotice}</div> : null}
                      {order.promoCode && order.promoDiscountLabel ? <div className="mt-2 inline-flex items-center rounded-full bg-[#effbf2] px-3 py-1 text-[10px] font-semibold text-[#1f7a39] sm:text-[12px]">Code {order.promoCode} · -{order.promoDiscountLabel}</div> : null}
                      <div className="mt-1.5 line-clamp-2 text-[11px] leading-4 text-[#6a6a6a] sm:mt-3 sm:text-[13px] sm:leading-6">
                        {order.logistics.lastUpdate}
                      </div>
                      {order.logistics.manualFulfillmentEnabled ? (
                        <div className="mt-3 rounded-[16px] bg-[#eef6ff] px-3 py-3 ring-1 ring-[#d8e5fb] sm:px-4">
                          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#1d4f91] sm:text-[12px]">
                            <ShieldCheck className="h-4 w-4" />
                            Livraison manuelle AfriPay
                          </div>
                          <div className="mt-2 grid gap-2 text-[11px] text-[#355d8e] sm:grid-cols-2 sm:text-[13px]">
                            <div>
                              <span className="font-semibold text-[#1d4f91]">Statut:</span> {order.logistics.manualFulfillmentStatusLabel || "Traitement en cours"}
                            </div>
                            <div>
                              <span className="font-semibold text-[#1d4f91]">Checkpoint:</span> {order.logistics.manualFulfillmentCheckpointLabel || "Hub AfriPay"}
                            </div>
                            {order.logistics.manualFulfillmentEtaLabel ? (
                              <div>
                                <span className="font-semibold text-[#1d4f91]">Prevision:</span> {order.logistics.manualFulfillmentEtaLabel}
                              </div>
                            ) : null}
                            {order.logistics.manualFulfillmentAgentPhone ? (
                              <div>
                                <span className="font-semibold text-[#1d4f91]">Contact:</span> {order.logistics.manualFulfillmentAgentPhone}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                      {order.logistics.relayPointAddress ? (
                        <div className="mt-3 rounded-[16px] bg-[#fff8ee] px-3 py-3 ring-1 ring-[#f5dfbe] sm:px-4">
                          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8a4b16] sm:text-[12px]">
                            <MapPin className="h-4 w-4" />
                            {order.logistics.relayPointLabel || "Point relais AfriPay"}
                          </div>
                          <div className="mt-2 text-[11px] leading-5 text-[#9d6434] sm:text-[13px] sm:leading-6">{order.logistics.relayPointAddress}</div>
                          {order.logistics.availableForPickupAt ? <div className="mt-2 text-[11px] font-medium text-[#9d6434] sm:text-[12px]">Disponible depuis {formatDateTimeLabel(order.logistics.availableForPickupAt)}</div> : null}
                        </div>
                      ) : null}
                      {order.logistics.proofs?.length ? (
                        <div className="mt-3 inline-flex items-center rounded-full bg-[#f5f7fa] px-3 py-1 text-[10px] font-semibold text-[#526071] ring-1 ring-[#e4e8ee] sm:text-[12px]">
                          {order.logistics.proofs.length} preuve(s) archivee(s)
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="space-y-2.5 sm:space-y-3">
                  {(() => {
                    const actions = getOrderActions(order);

                    return (
                      <>
                        {actions.primaryHref ? (
                          <Link href={actions.primaryHref} className="flex h-10 w-full items-center justify-center rounded-full bg-[#ea5c00] px-3 text-[13px] font-semibold text-white transition hover:bg-[#d85400] sm:h-12 sm:px-6 sm:text-[15px]">
                            <span className="sm:hidden">{getMobilePrimaryLabel(actions.primaryLabel)}</span>
                            <span className="hidden sm:inline">{actions.primaryLabel}</span>
                          </Link>
                        ) : (
                          <button className="flex h-10 w-full items-center justify-center rounded-full bg-[#ea5c00] px-3 text-[13px] font-semibold text-white transition hover:bg-[#d85400] sm:h-12 sm:px-6 sm:text-[15px]">
                            <span className="sm:hidden">{getMobilePrimaryLabel(actions.primaryLabel)}</span>
                            <span className="hidden sm:inline">{actions.primaryLabel}</span>
                          </button>
                        )}

                        {actions.secondaryLabel ? (
                          actions.secondaryHref ? (
                            <Link href={actions.secondaryHref} className="flex h-10 w-full items-center justify-center rounded-full border border-[#222] px-3 text-center text-[12px] font-semibold text-[#222] transition hover:border-[#ff6a00] hover:text-[#ff6a00] sm:h-12 sm:px-5 sm:text-[14px]">
                              <span className="sm:hidden">{getMobileSecondaryLabel(actions.secondaryLabel)}</span>
                              <span className="hidden sm:inline">{actions.secondaryLabel}</span>
                            </Link>
                          ) : (
                            <button className="flex h-10 w-full items-center justify-center rounded-full border border-[#222] px-3 text-center text-[12px] font-semibold text-[#222] transition hover:border-[#ff6a00] hover:text-[#ff6a00] sm:h-12 sm:px-5 sm:text-[14px]">
                              <span className="sm:hidden">{getMobileSecondaryLabel(actions.secondaryLabel)}</span>
                              <span className="hidden sm:inline">{actions.secondaryLabel}</span>
                            </button>
                          )
                        ) : null}
                      </>
                    );
                  })()}
                </div>
              </div>
            </article>
          ))}
        </div>
        </>
        ) : (
          <OrdersSidePanel
            activeSidebarItem={activeSidebarItem}
            orders={orders}
            refundRequests={refundRequests}
            reviewedOrders={reviewedOrders}
            onRefundRequest={handleRefundRequest}
            onReviewOrder={handleReviewOrder}
          />
        )}
      </section>
    </div>
  );
}
