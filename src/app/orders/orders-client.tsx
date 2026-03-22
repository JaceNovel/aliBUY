"use client";

import Image from "next/image";
import Link from "next/link";
import {
  CalendarDays,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  CreditCard,
  MessageCircle,
  ReceiptText,
  Search,
  SlidersHorizontal,
  Star,
  TicketPercent,
  Truck,
  Volume2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { getOrderChatHref, getOrderTrackingHref, orderTabs, orders, pendingProofDefaultOrder, sidebarItems, type OrderRecord, type OrderTab } from "@/lib/orders-data";

const dateOptions = [
  { value: "all", label: "Date de la commande" },
  ...Array.from(new Map(orders.map((order) => [order.dateValue, order.dateLabel.split(",")[0]])).entries()).map(([value, label]) => ({
    value,
    label,
  })),
];

const timeOptions = [
  { value: "all", label: "Selectionner l'heure" },
  ...Array.from(new Set(orders.map((order) => order.timeValue))).map((value) => ({
    value,
    label: value,
  })),
];

const sidebarItemMeta = {
  "Toutes les commandes": { label: "Commandes", icon: ClipboardList },
  "Remboursements et apres-vente": { label: "SAV", icon: ReceiptText },
  Avis: { label: "Avis", icon: Star },
  "Coupons et credits": { label: "Credits", icon: TicketPercent },
  "Informations fiscales": { label: "Fiscal", icon: CircleDollarSign },
} as const;

const orderTabMeta = {
  "Toutes les commandes": { shortLabel: "Toutes", icon: ClipboardList },
  "Paiements en attente (2)": { shortLabel: "Paiement", icon: CreditCard },
  "Expeditions en attente": { shortLabel: "Expedition", icon: Truck },
  "Livraisons en attente": { shortLabel: "Livraison", icon: Truck },
  "Commande Livré": { shortLabel: "Livre", icon: ReceiptText },
} as const satisfies Record<OrderTab, { shortLabel: string; icon: typeof ClipboardList }>;

function getOrderActions(order: OrderRecord) {
  if (order.status === "Paiement en attente") {
    return {
      primaryLabel: "Payer maintenant",
      primaryHref: null,
      secondaryLabel: "Soumettre une preuve de virement",
      secondaryHref: `/orders/remittance-proof?orderId=${encodeURIComponent(order.id)}`,
    };
  }

  if (order.status === "Expedition en attente") {
    return {
      primaryLabel: "Suivre l'expedition",
      primaryHref: getOrderTrackingHref(order),
      secondaryLabel: "Voir les details de la commande",
      secondaryHref: null,
    };
  }

  if (order.status === "Livraison en attente") {
    return {
      primaryLabel: "Suivre la livraison",
      primaryHref: getOrderTrackingHref(order),
      secondaryLabel: "Confirmer la reception",
      secondaryHref: null,
    };
  }

  return {
    primaryLabel: "Voir la preuve de livraison",
    primaryHref: null,
    secondaryLabel: "Voir les details de la commande",
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
    .replace("Chine", "CN")
    .replace("France", "FR")
    .replace("Togo", "TG")
    .replace("Ghana", "GH")
    .replace("Cote d'Ivoire", "CI")
    .replace(" -> ", " > ");
}

export function OrdersClient() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDate, setSelectedDate] = useState("all");
  const [selectedTime, setSelectedTime] = useState("all");
  const [activeTab, setActiveTab] = useState<OrderTab>("Toutes les commandes");

  const filteredOrders = useMemo(() => {
    const normalizedQuery = searchTerm.trim().toLowerCase();

    return orders.filter((order) => {
      const matchesSearch =
        !normalizedQuery ||
        `${order.id} ${order.title} ${order.variant} ${order.seller}`.toLowerCase().includes(normalizedQuery);
      const matchesDate = selectedDate === "all" || order.dateValue === selectedDate;
      const matchesTime = selectedTime === "all" || order.timeValue === selectedTime;
      const matchesTab = activeTab === "Toutes les commandes" || order.tab === activeTab;

      return matchesSearch && matchesDate && matchesTime && matchesTab;
    });
  }, [activeTab, searchTerm, selectedDate, selectedTime]);

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[240px_minmax(0,1fr)] xl:gap-6">
      <aside className="hidden self-start overflow-x-auto rounded-[22px] bg-[#f1f3f7] px-4 py-4 xl:sticky xl:top-8 xl:block xl:px-5 xl:py-6">
        <h2 className="text-[15px] font-semibold text-[#222]">Commandes</h2>
        <div className="mt-4 flex gap-2 text-[14px] text-[#333] xl:block xl:space-y-2">
          {sidebarItems.map((item, index) => (
            <div key={item} className={["shrink-0 rounded-[14px] px-4 py-2.5 leading-5", index === 0 ? "bg-white font-semibold" : "bg-white/60 xl:bg-transparent"].join(" ")}>
              {item}
            </div>
          ))}
        </div>
      </aside>

      <section className="min-w-0 bg-transparent px-0 py-0 shadow-none ring-0 sm:rounded-[28px] sm:bg-white sm:px-6 sm:py-6 sm:shadow-[0_8px_30px_rgba(24,39,75,0.05)] sm:ring-1 sm:ring-black/5 lg:px-7 lg:py-7">
        <div className="mb-4 xl:hidden">
          <div className="rounded-[20px] bg-[#f1f3f7] px-3 py-3">
            <div className="text-[15px] font-semibold text-[#222]">Commandes</div>
            <div className="mt-3 flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {sidebarItems.map((item, index) => {
                const meta = sidebarItemMeta[item as keyof typeof sidebarItemMeta];
                const Icon = meta.icon;

                return (
                  <div
                    key={item}
                    className={[
                      "flex shrink-0 items-center gap-2 rounded-[14px] px-3 py-2.5 text-[12px] font-semibold",
                      index === 0 ? "bg-white text-[#222] shadow-[0_6px_18px_rgba(17,24,39,0.06)]" : "bg-white/70 text-[#4a4a4a]",
                    ].join(" ")}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="whitespace-nowrap">{meta.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <h1 className="text-[20px] font-bold tracking-[-0.05em] text-[#222] sm:text-[28px] lg:text-[36px]">Vos commandes</h1>
          <Link href={`/orders/remittance-proof?orderId=${encodeURIComponent(pendingProofDefaultOrder.id)}`} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full border border-[#222] px-3 text-[12px] font-semibold text-[#222] transition hover:border-[#ff6a00] hover:text-[#ff6a00] sm:h-11 sm:w-auto sm:px-6 sm:text-[14px]">
            <CreditCard className="h-4 w-4" />
            <span className="sm:hidden">Preuve</span>
            <span className="hidden sm:inline">Soumettre une preuve de virement</span>
          </Link>
        </div>

        <div className="mt-5 flex gap-2.5 overflow-x-auto border-b border-[#e7e7e7] pb-1 text-[12px] text-[#333] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:gap-x-7 sm:gap-y-3 sm:overflow-visible sm:pb-0 sm:text-[14px]">
          {orderTabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={[
                "flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-1 pb-3 text-left transition sm:gap-2 sm:px-1.5",
                activeTab === tab ? "border-[#222] font-semibold text-[#222]" : "border-transparent hover:text-[#222]",
              ].join(" ")}
            >
              {(() => {
                const meta = orderTabMeta[tab];
                const Icon = meta.icon;

                return (
                  <>
                    <Icon className="h-4 w-4 sm:hidden" />
                    <span className="sm:hidden">{meta.shortLabel}</span>
                    <span className="hidden sm:inline">{tab}</span>
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
                      <div className="mt-1.5 line-clamp-2 text-[11px] leading-4 text-[#6a6a6a] sm:mt-3 sm:text-[13px] sm:leading-6">
                        {order.logistics.lastUpdate}
                      </div>
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

                        {actions.secondaryHref ? (
                          <Link href={actions.secondaryHref} className="flex h-10 w-full items-center justify-center rounded-full border border-[#222] px-3 text-center text-[12px] font-semibold text-[#222] transition hover:border-[#ff6a00] hover:text-[#ff6a00] sm:h-12 sm:px-5 sm:text-[14px]">
                            <span className="sm:hidden">{getMobileSecondaryLabel(actions.secondaryLabel)}</span>
                            <span className="hidden sm:inline">{actions.secondaryLabel}</span>
                          </Link>
                        ) : (
                          <button className="flex h-10 w-full items-center justify-center rounded-full border border-[#222] px-3 text-center text-[12px] font-semibold text-[#222] transition hover:border-[#ff6a00] hover:text-[#ff6a00] sm:h-12 sm:px-5 sm:text-[14px]">
                            <span className="sm:hidden">{getMobileSecondaryLabel(actions.secondaryLabel)}</span>
                            <span className="hidden sm:inline">{actions.secondaryLabel}</span>
                          </button>
                        )}
                      </>
                    );
                  })()}
                  <button className="mx-auto flex items-center gap-2 text-[13px] font-semibold text-[#333] sm:text-[14px]">
                    <SlidersHorizontal className="h-4 w-4 sm:hidden" />
                    Plus
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}