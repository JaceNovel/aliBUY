"use client";

import Link from "next/link";
import { Ship, ShoppingCart, Truck } from "lucide-react";
import { useMemo, useState } from "react";

import { useCart, useCartQuote } from "@/components/cart-provider";
import { formatFcfa } from "@/lib/alibaba-sourcing";

const defaultForm = {
  customerName: "",
  customerEmail: "",
  customerPhone: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postalCode: "",
  countryCode: "CI",
  notes: "",
};

export function SourcingCheckoutClient() {
  const { items, clearCart } = useCart();
  const { quote, isLoading } = useCartQuote();
  const [form, setForm] = useState(defaultForm);
  const [selectedShipping, setSelectedShipping] = useState<"air" | "sea">("air");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const shippingOptions = quote.shippingOptions;
  const selectedOption = useMemo(() => {
    return shippingOptions.find((option) => option.key === selectedShipping) ?? shippingOptions[0] ?? null;
  }, [selectedShipping, shippingOptions]);
  const totalPrice = quote.cartProductsTotalFcfa + (selectedOption?.priceFcfa ?? 0);

  const submitOrder = async () => {
    if (items.length === 0 || !selectedOption) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const response = await fetch("/api/alibaba-sourcing/orders", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        ...form,
        shippingMethod: selectedOption.key,
        items,
      }),
    });

    setIsSubmitting(false);

    if (!response.ok) {
      setErrorMessage("Impossible de créer la commande sourcing.");
      return;
    }

    const payload = await response.json();
    clearCart();
    setSuccessMessage(`Commande ${payload.order.orderNumber} créée. Freight: ${payload.order.freightStatus}. Supplier order: ${payload.order.supplierOrderStatus}.`);
  };

  if (items.length === 0) {
    return (
      <section className="rounded-[28px] border border-[#ece7df] bg-white px-5 py-10 text-center shadow-[0_16px_40px_rgba(17,24,39,0.05)] sm:px-8">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#fff0e6] text-[#ff6a00]">
          <ShoppingCart className="h-8 w-8" />
        </div>
        <h1 className="mt-5 text-[28px] font-black tracking-[-0.05em] text-[#1f2937]">Votre checkout sourcing est vide</h1>
        <p className="mt-3 text-[14px] leading-6 text-[#667085]">Ajoutez des produits au panier pour calculer le transport et créer une commande sourcing.</p>
        <Link href="/products" className="mt-6 inline-flex h-12 items-center justify-center rounded-full bg-[#ff6a00] px-6 text-[15px] font-semibold text-white transition hover:bg-[#e55e00]">Retour au catalogue</Link>
      </section>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
      <section className="rounded-[28px] border border-[#ece7df] bg-white p-5 shadow-[0_16px_40px_rgba(17,24,39,0.05)] sm:p-7">
        <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#ff6a00]">Checkout sourcing</div>
        <h1 className="mt-2 text-[30px] font-black tracking-[-0.05em] text-[#1f2937]">Adresse de livraison et création de commande</h1>
        <p className="mt-3 text-[14px] leading-6 text-[#667085]">Le paiement n&apos;est pas encore déclenché. Cette étape crée la commande sourcing, calcule le freight et prépare la création fournisseur Alibaba côté serveur.</p>

        {successMessage ? <div className="mt-4 rounded-[18px] bg-[#edf8f1] px-4 py-4 text-[13px] font-semibold text-[#127a46]">{successMessage}</div> : null}
        {errorMessage ? <div className="mt-4 rounded-[18px] bg-[#fde8e8] px-4 py-4 text-[13px] font-semibold text-[#b42318]">{errorMessage}</div> : null}

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="text-[13px] font-semibold text-[#344054]">
            Nom complet
            <input value={form.customerName} onChange={(event) => setForm((current) => ({ ...current, customerName: event.target.value }))} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] text-[#111827] outline-none focus:border-[#ff6a00]" />
          </label>
          <label className="text-[13px] font-semibold text-[#344054]">
            Email
            <input value={form.customerEmail} onChange={(event) => setForm((current) => ({ ...current, customerEmail: event.target.value }))} type="email" className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] text-[#111827] outline-none focus:border-[#ff6a00]" />
          </label>
          <label className="text-[13px] font-semibold text-[#344054]">
            Téléphone
            <input value={form.customerPhone} onChange={(event) => setForm((current) => ({ ...current, customerPhone: event.target.value }))} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] text-[#111827] outline-none focus:border-[#ff6a00]" />
          </label>
          <label className="text-[13px] font-semibold text-[#344054]">
            Pays
            <input value={form.countryCode} onChange={(event) => setForm((current) => ({ ...current, countryCode: event.target.value.toUpperCase() }))} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] uppercase text-[#111827] outline-none focus:border-[#ff6a00]" />
          </label>
          <label className="sm:col-span-2 text-[13px] font-semibold text-[#344054]">
            Adresse
            <input value={form.addressLine1} onChange={(event) => setForm((current) => ({ ...current, addressLine1: event.target.value }))} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] text-[#111827] outline-none focus:border-[#ff6a00]" />
          </label>
          <label className="sm:col-span-2 text-[13px] font-semibold text-[#344054]">
            Complément d&apos;adresse
            <input value={form.addressLine2} onChange={(event) => setForm((current) => ({ ...current, addressLine2: event.target.value }))} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] text-[#111827] outline-none focus:border-[#ff6a00]" />
          </label>
          <label className="text-[13px] font-semibold text-[#344054]">
            Ville
            <input value={form.city} onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] text-[#111827] outline-none focus:border-[#ff6a00]" />
          </label>
          <label className="text-[13px] font-semibold text-[#344054]">
            Région / État
            <input value={form.state} onChange={(event) => setForm((current) => ({ ...current, state: event.target.value }))} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] text-[#111827] outline-none focus:border-[#ff6a00]" />
          </label>
          <label className="sm:col-span-2 text-[13px] font-semibold text-[#344054]">
            Code postal
            <input value={form.postalCode} onChange={(event) => setForm((current) => ({ ...current, postalCode: event.target.value }))} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] text-[#111827] outline-none focus:border-[#ff6a00]" />
          </label>
          <label className="sm:col-span-2 text-[13px] font-semibold text-[#344054]">
            Note de commande
            <textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} className="mt-2 min-h-[120px] w-full rounded-[18px] border border-[#d7dce5] px-4 py-3 text-[14px] text-[#111827] outline-none focus:border-[#ff6a00]" />
          </label>
        </div>
      </section>

      <aside className="space-y-4">
        <section className="rounded-[28px] border border-[#ece7df] bg-white p-5 shadow-[0_16px_40px_rgba(17,24,39,0.05)]">
          <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#ff6a00]">Prix et transport</div>
          <div className="mt-2 text-[24px] font-black tracking-[-0.05em] text-[#1f2937]">{formatFcfa(quote.cartProductsTotalFcfa)}</div>
          <div className="mt-2 text-[13px] text-[#667085]">Produits finalisés avec marge, hors transport.</div>
          <div className="mt-4 rounded-[18px] bg-[#f8fafc] px-4 py-3 text-[13px] font-medium text-[#475467]">Livraison offerte dès {formatFcfa(15000)}. {quote.freeShippingMessage}</div>
        </section>

        <section className="rounded-[28px] border border-[#ece7df] bg-white p-5 shadow-[0_16px_40px_rgba(17,24,39,0.05)]">
          <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#ff6a00]">Choix de livraison</div>
          <div className="mt-4 space-y-3">
            {shippingOptions.map((option) => {
              const Icon = option.key === "air" ? Truck : Ship;

              return (
                <button key={option.key} type="button" onClick={() => setSelectedShipping(option.key)} className={["flex w-full items-start gap-3 rounded-[20px] border px-4 py-4 text-left transition", selectedShipping === option.key ? "border-[#ff6a00] bg-[#fff5ed]" : "border-[#e6eaf0] bg-white hover:border-[#ffb48a]"].join(" ")}>
                  <div className={["mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-[14px]", option.key === "air" ? "bg-[#fff0e6] text-[#ff6a00]" : "bg-[#eaf3ff] text-[#2f67f6]"].join(" ")}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[16px] font-semibold text-[#1f2937]">{option.label}</div>
                      <div className="text-[16px] font-black tracking-[-0.03em] text-[#1f2937]">{option.isFree ? "Gratuite" : formatFcfa(option.priceFcfa)}</div>
                    </div>
                    <div className="mt-1 text-[13px] text-[#667085]">{option.tradeLabel}</div>
                    <div className="mt-1 text-[13px] text-[#667085]">Délai estimé: {option.deliveryWindow}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-[28px] border border-[#ece7df] bg-white p-5 shadow-[0_16px_40px_rgba(17,24,39,0.05)]">
          <div className="flex items-center justify-between">
            <div className="text-[16px] font-semibold text-[#1f2937]">Produits</div>
            <div className="text-[16px] font-bold text-[#1f2937]">{formatFcfa(quote.cartProductsTotalFcfa)}</div>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <div className="text-[16px] font-semibold text-[#1f2937]">Livraison</div>
            <div className="text-[16px] font-bold text-[#1f2937]">{selectedOption ? (selectedOption.isFree ? "Gratuite" : formatFcfa(selectedOption.priceFcfa)) : formatFcfa(0)}</div>
          </div>
          <div className="mt-3 flex items-center justify-between text-[13px] text-[#667085]">
            <span>Poids total</span>
            <span>{quote.totalWeightKg.toFixed(3)} kg</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-[13px] text-[#667085]">
            <span>Volume total</span>
            <span>{quote.totalCbm.toFixed(4)} CBM</span>
          </div>
          <div className="mt-4 border-t border-[#edf1f6] pt-4">
            <div className="flex items-center justify-between">
              <div className="text-[18px] font-black tracking-[-0.04em] text-[#1f2937]">Total</div>
              <div className="text-[22px] font-black tracking-[-0.05em] text-[#1f2937]">{formatFcfa(totalPrice)}</div>
            </div>
          </div>
          <button type="button" onClick={submitOrder} disabled={isSubmitting || isLoading || !selectedOption} className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-full bg-[#ff6a00] px-6 text-[15px] font-semibold text-white transition hover:bg-[#e55e00] disabled:cursor-not-allowed disabled:opacity-70">
            {isSubmitting ? "Création en cours..." : "Créer la commande sourcing"}
          </button>
          <Link href="/cart" className="mt-3 inline-flex h-12 w-full items-center justify-center rounded-full border border-[#d9dfe8] px-6 text-[15px] font-semibold text-[#344054] transition hover:border-[#ff6a00] hover:text-[#ff6a00]">Retour au panier</Link>
        </section>
      </aside>
    </div>
  );
}