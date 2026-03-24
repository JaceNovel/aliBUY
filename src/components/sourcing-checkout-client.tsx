"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, MapPinned, Ship, ShoppingCart, Sparkles, Truck } from "lucide-react";
import { useMemo, useState } from "react";

import { useCart, useCartQuote } from "@/components/cart-provider";
import { formatFcfa } from "@/lib/alibaba-sourcing";
import { buildAddressQuickInput, parseAddressQuickInput } from "@/lib/address-autofill";
import type { CustomerAddressRecord } from "@/lib/customer-addresses";

const defaultForm = {
  customerAddressId: "",
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

type SourcingCheckoutClientProps = {
  initialUser: {
    displayName: string;
    email: string;
  };
  savedAddresses: CustomerAddressRecord[];
};

function buildFormFromAddress(address: CustomerAddressRecord, initialUser: SourcingCheckoutClientProps["initialUser"]) {
  return {
    ...defaultForm,
    customerAddressId: address.id,
    customerName: address.recipientName,
    customerEmail: address.email ?? initialUser.email,
    customerPhone: address.phone,
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2 ?? "",
    city: address.city,
    state: address.state,
    postalCode: address.postalCode ?? "",
    countryCode: address.countryCode,
  };
}

export function SourcingCheckoutClient({ initialUser, savedAddresses }: SourcingCheckoutClientProps) {
  const { items, clearCart } = useCart();
  const { quote, isLoading } = useCartQuote();
  const router = useRouter();
  const defaultAddress = savedAddresses.find((address) => address.isDefault) ?? savedAddresses[0];
  const [form, setForm] = useState({
    ...defaultForm,
    customerName: initialUser.displayName,
    customerEmail: initialUser.email,
    ...(defaultAddress ? buildFormFromAddress(defaultAddress, initialUser) : {}),
  });
  const [quickAddress, setQuickAddress] = useState(() => buildAddressQuickInput(defaultAddress ? buildFormFromAddress(defaultAddress, initialUser) : defaultForm));
  const [isManualAddress, setIsManualAddress] = useState(false);
  const [selectedShipping, setSelectedShipping] = useState<"air" | "sea">("air");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const shippingOptions = quote.shippingOptions;
  const selectedOption = useMemo(() => {
    return shippingOptions.find((option) => option.key === selectedShipping) ?? shippingOptions[0] ?? null;
  }, [selectedShipping, shippingOptions]);
  const totalPrice = quote.cartProductsTotalFcfa + (selectedOption?.priceFcfa ?? 0);

  const updateFormField = <Key extends keyof typeof form>(key: Key, value: (typeof form)[Key]) => {
    setForm((current) => ({
      ...current,
      [key]: value,
      customerAddressId:
        key === "customerName" ||
        key === "customerEmail" ||
        key === "customerPhone" ||
        key === "addressLine1" ||
        key === "addressLine2" ||
        key === "city" ||
        key === "state" ||
        key === "postalCode" ||
        key === "countryCode"
          ? ""
          : current.customerAddressId,
    }));
  };

  const applySavedAddress = (address: CustomerAddressRecord) => {
    const nextAddress = buildFormFromAddress(address, initialUser);
    setForm((current) => ({
      ...current,
      ...nextAddress,
      notes: current.notes,
    }));
    setQuickAddress(buildAddressQuickInput(nextAddress));
    setIsManualAddress(false);
  };

  const applyQuickAddress = (value: string) => {
    setQuickAddress(value);
    const parsedAddress = parseAddressQuickInput(value, form.countryCode || "CI");
    setForm((current) => ({
      ...current,
      ...parsedAddress,
      customerAddressId: "",
    }));
  };

  const submitOrder = async () => {
    if (items.length === 0 || !selectedOption) {
      return;
    }

    const normalizedForm = isManualAddress
      ? form
      : {
          ...form,
          ...parseAddressQuickInput(quickAddress, form.countryCode || "CI"),
          customerAddressId: form.customerAddressId,
        };

    setForm(normalizedForm);

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const response = await fetch("/api/alibaba-sourcing/orders", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        ...normalizedForm,
        shippingMethod: selectedOption.key,
        items,
      }),
    });

    setIsSubmitting(false);

    if (!response.ok) {
      if (response.status === 401) {
        router.push(`/login?next=${encodeURIComponent("/checkout")}`);
        return;
      }

      setErrorMessage("Impossible de créer la commande sourcing.");
      return;
    }

    const payload = await response.json();
    clearCart();
    router.push(`/orders/payment?orderId=${encodeURIComponent(payload.order.id)}`);
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
        <p className="mt-3 text-[14px] leading-6 text-[#667085]">Cette étape crée la commande sourcing, calcule le freight, prépare la création fournisseur Alibaba puis vous redirige vers la page de paiement Moneroo.</p>

        <div className="mt-5 rounded-[22px] bg-[#fff7ef] p-4 ring-1 ring-[#f1ddcd] sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#d85300]">Adresses enregistrées</div>
              <div className="mt-1 text-[14px] text-[#5f534a]">Choisissez une adresse sauvegardée ou gérez votre carnet d'adresses.</div>
            </div>
            <Link href="/account/addresses" className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[#e3c9b8] bg-white px-4 text-[13px] font-semibold text-[#49352a] transition hover:border-[#ff6a00] hover:text-[#ff6a00]">
              <MapPinned className="h-4 w-4" />
              Gérer mes adresses
            </Link>
          </div>

          {savedAddresses.length > 0 ? (
            <div className="mt-4 grid gap-3">
              {savedAddresses.map((address) => {
                const isActive = form.customerAddressId === address.id;

                return (
                  <button
                    key={address.id}
                    type="button"
                    onClick={() => applySavedAddress(address)}
                    className={[
                      "rounded-[18px] border px-4 py-4 text-left transition",
                      isActive ? "border-[#ff6a00] bg-white shadow-[0_10px_24px_rgba(255,106,0,0.08)]" : "border-[#ead9cc] bg-white/70 hover:border-[#ffb48a]",
                    ].join(" ")}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className={[
                          "flex h-6 w-6 items-center justify-center rounded-full border",
                          isActive ? "border-[#ff6a00] bg-[#ff6a00] text-white" : "border-[#d8c3b3] bg-white text-transparent",
                        ].join(" ")}>
                          <Check className="h-3.5 w-3.5" />
                        </div>
                        <span className="text-[15px] font-semibold text-[#221f1c]">{address.label}</span>
                      </div>
                      {address.isDefault ? <span className="rounded-full bg-[#fff2e9] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#d85300]">Par défaut</span> : null}
                    </div>
                    <div className="mt-2 text-[14px] font-medium text-[#221f1c]">{address.recipientName}</div>
                    <div className="mt-1 text-[13px] leading-6 text-[#6b7280]">{[address.addressLine1, address.addressLine2, `${address.city}, ${address.state}`, address.postalCode, address.countryCode].filter(Boolean).join(" · ")}</div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="mt-4 rounded-[18px] border border-dashed border-[#e1cbb8] bg-white/80 px-4 py-4 text-[13px] leading-6 text-[#6b5a4d]">
              Aucune adresse enregistrée pour le moment. Vous pouvez renseigner votre adresse ci-dessous puis l'enregistrer depuis votre espace compte.
            </div>
          )}
        </div>

        {successMessage ? <div className="mt-4 rounded-[18px] bg-[#edf8f1] px-4 py-4 text-[13px] font-semibold text-[#127a46]">{successMessage}</div> : null}
        {errorMessage ? <div className="mt-4 rounded-[18px] bg-[#fde8e8] px-4 py-4 text-[13px] font-semibold text-[#b42318]">{errorMessage}</div> : null}

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="text-[13px] font-semibold text-[#344054]">
            Nom complet
            <input value={form.customerName} onChange={(event) => updateFormField("customerName", event.target.value)} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] text-[#111827] outline-none focus:border-[#ff6a00]" />
          </label>
          <label className="text-[13px] font-semibold text-[#344054]">
            Email
            <input value={form.customerEmail} onChange={(event) => updateFormField("customerEmail", event.target.value)} type="email" autoComplete="email" className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] text-[#111827] outline-none focus:border-[#ff6a00]" />
          </label>
          <label className="text-[13px] font-semibold text-[#344054]">
            Téléphone
            <input value={form.customerPhone} onChange={(event) => updateFormField("customerPhone", event.target.value)} autoComplete="tel" className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] text-[#111827] outline-none focus:border-[#ff6a00]" />
          </label>
          <div className="sm:col-span-2 rounded-[20px] border border-[#e6eaf0] bg-[#fbfcfe] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-[#fff2e9] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#d85300]">
                  <Sparkles className="h-3.5 w-3.5" />
                  Adresse rapide
                </div>
                <p className="mt-2 text-[13px] leading-6 text-[#667085]">
                  Saisissez votre adresse actuelle en une ligne puis laissez le formulaire répartir les informations.
                </p>
              </div>
              <button type="button" onClick={() => {
                if (isManualAddress) {
                  setQuickAddress(buildAddressQuickInput(form));
                }
                setIsManualAddress((current) => !current);
              }} className="inline-flex h-10 items-center justify-center rounded-full border border-[#d7dce5] px-4 text-[13px] font-semibold text-[#344054] transition hover:border-[#ff6a00] hover:text-[#ff6a00]">
                {isManualAddress ? "Masquer les champs manuels" : "Saisir l'adresse manuellement"}
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <label className="min-w-0 flex-1 text-[13px] font-semibold text-[#344054]">
                Mon adresse actuelle
                <input value={quickAddress} onChange={(event) => setQuickAddress(event.target.value)} placeholder="Ex: Yopougon Maroc, Abidjan, Lagunes, CI" autoComplete="street-address" className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] text-[#111827] outline-none focus:border-[#ff6a00]" />
              </label>
              <button type="button" onClick={() => applyQuickAddress(quickAddress)} className="inline-flex h-11 items-center justify-center rounded-full bg-[#1f2937] px-5 text-[13px] font-semibold text-white transition hover:bg-[#101828] sm:mt-[26px]">
                Auto-remplir
              </button>
            </div>

            <div className="mt-2 text-[12px] leading-5 text-[#667085]">
              Le mode rapide préremplit rue, ville, région, code postal et pays. Pour une adresse détaillée, ouvrez la saisie manuelle.
            </div>

            {isManualAddress ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="text-[13px] font-semibold text-[#344054]">
                  Pays
                  <input value={form.countryCode} onChange={(event) => updateFormField("countryCode", event.target.value.toUpperCase())} autoComplete="country" className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] uppercase text-[#111827] outline-none focus:border-[#ff6a00]" />
                </label>
                <div />
                <label className="sm:col-span-2 text-[13px] font-semibold text-[#344054]">
                  Adresse
                  <input value={form.addressLine1} onChange={(event) => updateFormField("addressLine1", event.target.value)} autoComplete="address-line1" className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] text-[#111827] outline-none focus:border-[#ff6a00]" />
                </label>
                <label className="sm:col-span-2 text-[13px] font-semibold text-[#344054]">
                  Complément d&apos;adresse
                  <input value={form.addressLine2} onChange={(event) => updateFormField("addressLine2", event.target.value)} autoComplete="address-line2" className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] text-[#111827] outline-none focus:border-[#ff6a00]" />
                </label>
                <label className="text-[13px] font-semibold text-[#344054]">
                  Ville
                  <input value={form.city} onChange={(event) => updateFormField("city", event.target.value)} autoComplete="address-level2" className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] text-[#111827] outline-none focus:border-[#ff6a00]" />
                </label>
                <label className="text-[13px] font-semibold text-[#344054]">
                  Région / État
                  <input value={form.state} onChange={(event) => updateFormField("state", event.target.value)} autoComplete="address-level1" className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] text-[#111827] outline-none focus:border-[#ff6a00]" />
                </label>
                <label className="sm:col-span-2 text-[13px] font-semibold text-[#344054]">
                  Code postal
                  <input value={form.postalCode} onChange={(event) => updateFormField("postalCode", event.target.value)} autoComplete="postal-code" className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] text-[#111827] outline-none focus:border-[#ff6a00]" />
                </label>
              </div>
            ) : null}
          </div>
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
            {isSubmitting ? "Création en cours..." : "Continuer vers le paiement"}
          </button>
          <Link href="/cart" className="mt-3 inline-flex h-12 w-full items-center justify-center rounded-full border border-[#d9dfe8] px-6 text-[15px] font-semibold text-[#344054] transition hover:border-[#ff6a00] hover:text-[#ff6a00]">Retour au panier</Link>
        </section>
      </aside>
    </div>
  );
}