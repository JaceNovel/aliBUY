"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import type { AdminOrderRecord } from "@/lib/admin-data";

type AdminOrdersPageClientProps = {
  orders: AdminOrderRecord[];
  locale: string;
};

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function formatFcfa(amount: number, locale: string) {
  return `${new Intl.NumberFormat(locale || "fr-FR", {
    maximumFractionDigits: 0,
  }).format(amount)} FCFA`;
}

function formatPaymentLabel(status: string) {
  switch (status) {
    case "paid":
      return "Payé";
    case "failed":
      return "Échec";
    case "pending":
      return "En attente";
    case "initialized":
      return "Initialisé";
    case "cancelled":
      return "Annulé";
    default:
      return status || "-";
  }
}

function formatStatusLabel(status: string, paymentStatus: string) {
  if (paymentStatus === "failed") {
    return "Échec";
  }

  switch (status) {
    case "completed":
      return "Terminée";
    case "relay_ready":
      return "Point relais";
    case "delivered_to_agent":
      return "Livrée à l'agent";
    case "shipment_triggered":
      return "Transport";
    case "supplier_paid":
      return "Achat réglé";
    case "checkout_created":
      return paymentStatus === "paid" ? "Payée" : "Créée";
    default:
      return formatPaymentLabel(status);
  }
}

function toDateInputValue(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return parsed.toISOString().slice(0, 10);
}

export function AdminOrdersPageClient({ orders, locale }: AdminOrdersPageClientProps) {
  const [emailQuery, setEmailQuery] = useState("");
  const [referenceQuery, setReferenceQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const filteredOrders = useMemo(() => {
    const normalizedEmailQuery = normalizeText(emailQuery);
    const normalizedReferenceQuery = normalizeText(referenceQuery);

    return orders.filter((order) => {
      const normalizedEmail = normalizeText(order.customerEmail);
      const normalizedCustomerName = normalizeText(order.customerName);
      const normalizedOrderNumber = normalizeText(order.orderNumber);
      const normalizedProductTitle = normalizeText(order.productTitle);
      const orderDate = toDateInputValue(order.createdAt);

      if (normalizedEmailQuery && !normalizedEmail.includes(normalizedEmailQuery) && !normalizedCustomerName.includes(normalizedEmailQuery)) {
        return false;
      }

      if (normalizedReferenceQuery && !normalizedOrderNumber.includes(normalizedReferenceQuery) && !normalizedProductTitle.includes(normalizedReferenceQuery)) {
        return false;
      }

      if (statusFilter !== "all" && formatStatusLabel(order.status, order.paymentStatus) !== statusFilter) {
        return false;
      }

      if (paymentFilter !== "all" && formatPaymentLabel(order.paymentStatus) !== paymentFilter) {
        return false;
      }

      if (fromDate && (!orderDate || orderDate < fromDate)) {
        return false;
      }

      if (toDate && (!orderDate || orderDate > toDate)) {
        return false;
      }

      return true;
    });
  }, [emailQuery, fromDate, orders, paymentFilter, referenceQuery, statusFilter, toDate]);

  const statusOptions = useMemo(() => {
    return ["all", ...Array.from(new Set(orders.map((order) => formatStatusLabel(order.status, order.paymentStatus))))];
  }, [orders]);

  const paymentOptions = useMemo(() => {
    return ["all", ...Array.from(new Set(orders.map((order) => formatPaymentLabel(order.paymentStatus))))];
  }, [orders]);

  return (
    <div className="space-y-6">
      <section className="rounded-[24px] border border-[#e3e8ef] bg-white px-6 py-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
        <h1 className="text-[22px] font-black tracking-[-0.04em] text-[#ff4d4f] sm:text-[26px]">Commandes</h1>
        <p className="mt-1 text-[14px] text-[#667085]">Toutes les commandes clients</p>
      </section>

      <section className="rounded-[24px] border border-[#e3e8ef] bg-white px-4 py-4 shadow-[0_12px_32px_rgba(15,23,42,0.05)] sm:px-5">
        <div className="grid gap-3 xl:grid-cols-[1.1fr_1.05fr_1fr_1fr_1fr_1fr]">
          <label className="relative block">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#98a2b3]">
              <Search className="h-4 w-4" />
            </span>
            <input
              value={emailQuery}
              onChange={(event) => setEmailQuery(event.target.value)}
              placeholder="Email client"
              className="h-12 w-full rounded-[16px] border border-[#d8dee8] bg-white pl-11 pr-4 text-[14px] text-[#1f2937] outline-none transition focus:border-[#ff6a5b]"
            />
          </label>

          <input
            value={referenceQuery}
            onChange={(event) => setReferenceQuery(event.target.value)}
            placeholder="Référence"
            className="h-12 w-full rounded-[16px] border border-[#d8dee8] bg-white px-4 text-[14px] text-[#1f2937] outline-none transition focus:border-[#ff6a5b]"
          />

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="h-12 w-full rounded-[16px] border border-[#d8dee8] bg-white px-4 text-[14px] text-[#111827] outline-none transition focus:border-[#ff6a5b]"
          >
            {statusOptions.map((option) => (
              <option key={option} value={option}>{option === "all" ? "Tous statuts" : option}</option>
            ))}
          </select>

          <select
            value={paymentFilter}
            onChange={(event) => setPaymentFilter(event.target.value)}
            className="h-12 w-full rounded-[16px] border border-[#d8dee8] bg-white px-4 text-[14px] text-[#111827] outline-none transition focus:border-[#ff6a5b]"
          >
            {paymentOptions.map((option) => (
              <option key={option} value={option}>{option === "all" ? "Paiement" : option}</option>
            ))}
          </select>

          <input
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
            className="h-12 w-full rounded-[16px] border border-[#d8dee8] bg-white px-4 text-[14px] text-[#111827] outline-none transition focus:border-[#ff6a5b]"
          />

          <input
            type="date"
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
            className="h-12 w-full rounded-[16px] border border-[#d8dee8] bg-white px-4 text-[14px] text-[#111827] outline-none transition focus:border-[#ff6a5b]"
          />
        </div>
      </section>

      <section className="overflow-hidden rounded-[24px] border border-[#e3e8ef] bg-white shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
        <div className="px-5 py-5 text-[15px] font-medium text-[#667085]">{filteredOrders.length} commande(s)</div>
        <div className="overflow-x-auto px-4 pb-4 sm:px-5">
          <table className="min-w-full border-separate border-spacing-0 text-left">
            <thead>
              <tr className="text-[12px] font-semibold uppercase tracking-[0.05em] text-[#8da0bd]">
                <th className="border-b border-[#edf1f6] px-3 py-3">ID</th>
                <th className="border-b border-[#edf1f6] px-3 py-3">Client</th>
                <th className="border-b border-[#edf1f6] px-3 py-3">Commande</th>
                <th className="border-b border-[#edf1f6] px-3 py-3">Montant</th>
                <th className="border-b border-[#edf1f6] px-3 py-3">Statut</th>
                <th className="border-b border-[#edf1f6] px-3 py-3">Paiement</th>
                <th className="border-b border-[#edf1f6] px-3 py-3">Créée</th>
                <th className="border-b border-[#edf1f6] px-3 py-3 text-right">Détails</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => (
                <tr key={order.id} className="text-[14px] text-[#101828]">
                  <td className="border-b border-[#edf1f6] px-3 py-4 font-semibold text-[#101828]">#{order.displayNumber}</td>
                  <td className="border-b border-[#edf1f6] px-3 py-4">
                    <div className="font-semibold uppercase text-[#0f172a]">{order.customerName || "Client"}</div>
                    <div className="text-[13px] text-[#5f7aa0]">{order.customerEmail || "-"}</div>
                  </td>
                  <td className="border-b border-[#edf1f6] px-3 py-4">
                    <div className="font-semibold text-[#23324d]">{order.orderNumber}</div>
                    <div className="text-[13px] text-[#475467]">{order.productTitle}</div>
                  </td>
                  <td className="border-b border-[#edf1f6] px-3 py-4 font-semibold text-[#101828]">{formatFcfa(order.totalPriceFcfa, locale)}</td>
                  <td className="border-b border-[#edf1f6] px-3 py-4">{formatStatusLabel(order.status, order.paymentStatus)}</td>
                  <td className="border-b border-[#edf1f6] px-3 py-4">{formatPaymentLabel(order.paymentStatus)}</td>
                  <td className="border-b border-[#edf1f6] px-3 py-4 text-[#5f7aa0]">{order.createdAt}</td>
                  <td className="border-b border-[#edf1f6] px-3 py-4 text-right">
                    <Link href={order.href} className="inline-flex h-9 items-center justify-center rounded-full border border-[#d8dee8] bg-white px-5 text-[13px] font-semibold text-[#344054] transition hover:border-[#ff6a5b] hover:text-[#ff6a5b]">
                      Voir
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}