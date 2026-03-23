"use client";

import { useMemo, useState } from "react";
import { CheckCheck, CircleAlert, ClipboardList, PackageCheck, Search, Truck } from "lucide-react";

import { getOrderTrackingNumber, type OrderRecord } from "@/lib/orders-data";

type TrackingClientProps = {
  orders: OrderRecord[];
  initialOrderId?: string;
  initialTracking?: string;
};

function resolveTrackingOrder(orders: OrderRecord[], orderId?: string, tracking?: string) {
  return orders.find((order) => order.id === orderId)
    ?? orders.find((order) => getOrderTrackingNumber(order) === tracking)
    ?? orders[0]
    ?? null;
}

function getTrackingSteps(order: OrderRecord) {
  const currentIndex =
    order.status === "Paiement en attente"
      ? 0
      : order.status === "Expedition en attente"
        ? 1
        : order.status === "Livraison en attente"
          ? 2
          : 3;

  return [
    {
      key: "received",
      title: "Commande recue",
      description: order.dateLabel.split(",")[0],
      icon: ClipboardList,
      state: currentIndex >= 0 ? "done" : "pending",
    },
    {
      key: "preparing",
      title: "En preparation",
      description: currentIndex >= 1 ? "Colis confirme" : "En attente",
      icon: CircleAlert,
      state: currentIndex >= 1 ? "done" : "pending",
    },
    {
      key: "shipped",
      title: "Expedie",
      description: currentIndex >= 2 ? order.logistics.transitMode : "En attente",
      icon: Truck,
      state: currentIndex >= 2 ? "done" : "pending",
    },
    {
      key: "delivered",
      title: "Livre",
      description: currentIndex >= 3 ? "Commande remise" : "En attente",
      icon: PackageCheck,
      state: currentIndex >= 3 ? "done" : "pending",
    },
  ] as const;
}

export function TrackingClient({ orders, initialOrderId, initialTracking }: TrackingClientProps) {
  const initialOrder = resolveTrackingOrder(orders, initialOrderId, initialTracking);
  const [trackingValue, setTrackingValue] = useState(initialOrder ? getOrderTrackingNumber(initialOrder) : initialTracking ?? "");
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(initialOrder);

  const steps = useMemo(() => (selectedOrder ? getTrackingSteps(selectedOrder) : []), [selectedOrder]);

  const handleSearch = () => {
    const nextOrder = orders.find((order) => getOrderTrackingNumber(order) === trackingValue)
      ?? orders.find((order) => order.id === trackingValue);

    if (nextOrder) {
      setSelectedOrder(nextOrder);
    }
  };

  if (!selectedOrder) {
    return null;
  }

  return (
    <section className="mx-auto max-w-[980px] rounded-[24px] bg-white px-4 py-5 shadow-[0_8px_30px_rgba(24,39,75,0.05)] ring-1 ring-black/5 sm:rounded-[30px] sm:px-6 sm:py-7 lg:px-8">
      <h1 className="text-[28px] font-bold tracking-[-0.05em] text-[#111] sm:text-[40px]">Suivi de commande</h1>

      <div className="mt-5">
        <label className="text-[13px] font-semibold text-[#222] sm:text-[15px]">Numero de suivi</label>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <div className="flex h-12 items-center gap-3 rounded-[14px] bg-[#eef4ff] px-4 ring-1 ring-[#dde7ff] sm:flex-1">
            <Search className="h-4 w-4 text-[#456]" />
            <input
              value={trackingValue}
              onChange={(event) => setTrackingValue(event.target.value)}
              className="w-full min-w-0 bg-transparent text-[13px] font-medium text-[#223] outline-none sm:text-[15px]"
            />
          </div>
          <button
            type="button"
            onClick={handleSearch}
            className="inline-flex h-12 items-center justify-center rounded-[14px] bg-[#e7345f] px-6 text-[14px] font-semibold text-white transition hover:bg-[#d22d55]"
          >
            Rechercher
          </button>
        </div>
      </div>

      <article className="mt-6 rounded-[20px] bg-[#fafafa] px-4 py-5 ring-1 ring-black/5 sm:px-6 sm:py-6">
        <h2 className="text-[20px] font-bold tracking-[-0.04em] text-[#111] sm:text-[24px]">Informations de commande</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 sm:gap-6">
          <div>
            <div className="text-[13px] text-[#7b8794]">Numero de commande</div>
            <div className="mt-1 break-all text-[18px] font-semibold text-[#111] sm:text-[22px]">{selectedOrder.id}</div>
          </div>
          <div>
            <div className="text-[13px] text-[#7b8794]">Date de commande</div>
            <div className="mt-1 text-[18px] font-semibold text-[#111] sm:text-[22px]">{selectedOrder.dateLabel.split(",")[0]}</div>
          </div>
          <div>
            <div className="text-[13px] text-[#7b8794]">Statut</div>
            <div className="mt-1 text-[18px] font-semibold text-[#111] sm:text-[22px]">{selectedOrder.status}</div>
          </div>
          <div>
            <div className="text-[13px] text-[#7b8794]">Livraison estimee</div>
            <div className="mt-1 text-[18px] font-semibold text-[#111] sm:text-[22px]">
              {selectedOrder.status === "Commande Livree" ? selectedOrder.dateLabel.split(",")[0] : "26 mars 2025"}
            </div>
          </div>
        </div>
      </article>

      <div className="mt-7 space-y-5 sm:mt-8 sm:space-y-7">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isDone = step.state === "done";

          return (
            <div key={step.key} className="relative flex gap-4 pl-2">
              {index < steps.length - 1 ? (
                <div className={["absolute left-[19px] top-12 w-[3px] rounded-full", isDone ? "bottom-[-28px] bg-[#d7ddeb]" : "bottom-[-28px] bg-[#e8ebf2]"].join(" ")} />
              ) : null}
              <div
                className={[
                  "relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1",
                  isDone ? "bg-[#d8f8df] text-[#10a34a] ring-[#bde9c9]" : "bg-[#f3f5f8] text-[#9aa3b2] ring-[#e1e6ef]",
                ].join(" ")}
              >
                {index === steps.length - 1 && isDone ? <CheckCheck className="h-5 w-5" /> : <Icon className="h-4.5 w-4.5" />}
              </div>
              <div className="min-w-0 pb-2">
                <div className="text-[17px] font-semibold tracking-[-0.03em] text-[#111] sm:text-[20px]">{step.title}</div>
                <div className="mt-1 text-[14px] text-[#7b8794] sm:text-[15px]">{step.description}</div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}