"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { AlertTriangle, Check, ChevronDown, CircleHelp, LocateFixed, Minus, Plus, ShieldCheck, Ship, ShoppingCart, Truck, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useCart, useCartQuote } from "@/components/cart-provider";
import { buildLocalUrl, createOrder, previewPromoCode } from "@/lib/api";
import {
  formatShippingTradeLabel,
  formatSourcingAmount,
  isSupportedDirectDeliveryCountry,
  resolveSourcingDeliveryPlan,
  type SourcingDeliveryMode,
  type ShippingMethodKey,
} from "@/lib/alibaba-sourcing";
import { buildAddressQuickInput } from "@/lib/address-autofill";
import { canonicalizeCountryCode, getCountryDisplayLabel } from "@/lib/country-utils";
import type { CustomerAddressRecord } from "@/lib/customer-addresses";
import { extractCoordinatesFromGoogleMapsUrl, isGoogleMapsShortUrl } from "@/lib/google-maps";
import { DELIVERY_COUNTRY_OPTIONS, type CountryCode } from "@/lib/pricing-options";

const defaultForm = {
  customerAddressId: "",
  customerName: "",
  customerEmail: "",
  customerPhone: "",
  googleMapsUrl: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postalCode: "",
  countryCode: "TG",
  notes: "",
};

type SourcingCheckoutClientProps = {
  initialUser: {
    displayName: string;
    email: string;
  };
  savedAddresses: CustomerAddressRecord[];
  initialCountryCode: string;
  currencyCode: string;
  locale: string;
  initialPromoCode?: string;
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

function buildFormFromAddress(address: CustomerAddressRecord, initialUser: SourcingCheckoutClientProps["initialUser"]) {
  const countryCode = canonicalizeCountryCode(address.countryCode, "TG");

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
    countryCode,
  };
}

function formatSavedAddress(address: CustomerAddressRecord) {
  return [
    address.addressLine1,
    address.addressLine2,
    `${address.city}, ${address.state}`,
    address.postalCode,
    getCountryDisplayLabel(address.countryCode),
  ]
    .filter(Boolean)
    .join(" · ");
}

function sortAddresses(addresses: CustomerAddressRecord[]) {
  return [...addresses].sort((left, right) => {
    if (left.isDefault === right.isDefault) {
      return right.updatedAt.localeCompare(left.updatedAt);
    }

    return left.isDefault ? -1 : 1;
  });
}

export function SourcingCheckoutClient({ initialUser, savedAddresses, initialCountryCode, currencyCode, locale, initialPromoCode }: SourcingCheckoutClientProps) {
  const { items, updateItem, clearCart, sharedCartContext, clearSharedCartContext } = useCart();
  const router = useRouter();
  const defaultAddress = savedAddresses.find((address) => address.isDefault) ?? savedAddresses[0];
  const [savedAddressList, setSavedAddressList] = useState(() => sortAddresses(savedAddresses));
  const [form, setForm] = useState({
    ...defaultForm,
    customerName: initialUser.displayName,
    customerEmail: initialUser.email,
    countryCode: canonicalizeCountryCode(initialCountryCode, defaultForm.countryCode),
    ...(defaultAddress ? buildFormFromAddress(defaultAddress, initialUser) : {}),
  });
  const [deliveryMode, setDeliveryMode] = useState<SourcingDeliveryMode>("direct");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [promoCodeInput, setPromoCodeInput] = useState(initialPromoCode ?? "");
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; label: string; discountFcfa: number; finalTotalFcfa: number; baseTotalFcfa: number } | null>(null);
  const [promoMessage, setPromoMessage] = useState<string | null>(null);
  const [isApplyingPromo, setIsApplyingPromo] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isResolvingMapsLink, setIsResolvingMapsLink] = useState(false);
  const [locationFeedback, setLocationFeedback] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasUserSelectedShipping, setHasUserSelectedShipping] = useState(false);
  const [selectedShipping, setSelectedShipping] = useState<ShippingMethodKey>("air");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<"card" | "mobile" | "bank">("card");
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(savedAddresses.length === 0);
  const [addressModalView, setAddressModalView] = useState<"list" | "form">(savedAddresses.length === 0 ? "form" : "list");
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [isAddressDefaultDraft, setIsAddressDefaultDraft] = useState(savedAddresses.length === 0);
  const [isPromoOpen, setIsPromoOpen] = useState(Boolean(initialPromoCode));
  const hasAutoAppliedPromoRef = useRef(false);
  const forwarderAddressBlock = "";
  const forwarderParcelMarking = "";

  const deliveryPlan = useMemo(() => resolveSourcingDeliveryPlan({
    countryCode: form.countryCode,
    city: form.city,
    deliveryProfile: {
      mode: deliveryMode,
      useExactPosition: Boolean(form.googleMapsUrl),
      googleMapsUrl: form.googleMapsUrl || undefined,
      detectedCountryCode: form.countryCode,
      detectedCity: form.city,
      forwarder: deliveryMode === "forwarder"
        ? {
            hub: "china",
            addressBlock: forwarderAddressBlock,
            parcelMarking: forwarderParcelMarking || undefined,
          }
        : undefined,
    },
  }), [deliveryMode, form.city, form.countryCode, form.googleMapsUrl, forwarderAddressBlock, forwarderParcelMarking]);

  const { quote, isLoading } = useCartQuote({ disableFreeAir: !deliveryPlan.workflow.freeDeliveryEligible, deliveryMode });
  const shippingOptions = quote.shippingOptions;
  const usesInternalReceptionAddress = deliveryPlan.deliveryProfile.usesInternalReceptionAddress === true;
  const isDirectAliExpressFlow = deliveryMode !== "forwarder" && !usesInternalReceptionAddress;
  const requiresTransitAddress = deliveryPlan.deliveryProfile.unsupportedCountry === true || !isSupportedDirectDeliveryCountry(form.countryCode);

  useEffect(() => {
    if (shippingOptions.length === 0) {
      return;
    }

    const hasSelectedOption = shippingOptions.some((option) => option.key === selectedShipping);
    if (!hasSelectedOption) {
      setSelectedShipping(quote.recommendedMethod);
      return;
    }

    if (!hasUserSelectedShipping && selectedShipping !== quote.recommendedMethod) {
      setSelectedShipping(quote.recommendedMethod);
    }
  }, [hasUserSelectedShipping, quote.recommendedMethod, selectedShipping, shippingOptions]);

  const selectedOption = useMemo(() => shippingOptions.find((option) => option.key === selectedShipping) ?? shippingOptions[0] ?? null, [selectedShipping, shippingOptions]);
  const baseTotalPrice = quote.cartProductsTotalFcfa + (selectedOption?.priceFcfa ?? 0);
  const totalPrice = appliedPromo?.baseTotalFcfa === baseTotalPrice ? appliedPromo.finalTotalFcfa : baseTotalPrice;
  const quickAddress = useMemo(() => buildAddressQuickInput(form), [form]);
  const activeAddressSummary = quickAddress || "Ajoutez une adresse de livraison";
  const selectedShippingLabel = selectedOption
    ? `${selectedOption.isFree ? "gratuit" : formatSourcingAmount(selectedOption.priceFcfa, { currencyCode, locale })}`
    : formatSourcingAmount(0, { currencyCode, locale });
  const paymentChoices = [
    {
      key: "card" as const,
      title: "Carte bancaire",
      subtitle: "Visa, Mastercard et cartes compatibles Moneroo",
      logo: "CB",
      logoClassName: "bg-[#f5f5f5] text-[#111827]",
    },
    {
      key: "mobile" as const,
      title: "Mobile Money",
      subtitle: "Paiement mobile pris en charge directement dans le checkout Moneroo",
      logo: "MM",
      logoClassName: "bg-[#eefcf3] text-[#15803d]",
    },
    {
      key: "bank" as const,
      title: "Virement bancaire",
      subtitle: "Méthodes bancaires locales disponibles selon votre configuration",
      logo: "VB",
      logoClassName: "bg-[#fff7ed] text-[#c2410c]",
    },
  ];

  useEffect(() => {
    if (!appliedPromo) {
      return;
    }

    if (appliedPromo.baseTotalFcfa !== baseTotalPrice) {
      setAppliedPromo(null);
      setPromoMessage("Le panier a changé. Réappliquez le code promo.");
    }
  }, [appliedPromo, baseTotalPrice]);

  const updateFormField = <Key extends keyof typeof form>(key: Key, value: (typeof form)[Key]) => {
    setForm((current) => ({
      ...current,
      [key]: value,
      customerAddressId:
        key === "customerName" ||
        key === "customerEmail" ||
        key === "customerPhone" ||
        key === "googleMapsUrl" ||
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
    setForm((current) => ({ ...current, ...nextAddress, notes: current.notes }));
    setDeliveryMode("direct");
    setLocationFeedback(null);
    setEditingAddressId(null);
    setAddressModalView("list");
    setIsAddressModalOpen(false);
  };

  const syncSavedAddresses = (nextAddresses: CustomerAddressRecord[]) => {
    setSavedAddressList(sortAddresses(nextAddresses));
  };

  const openAddressSelector = () => {
    setErrorMessage(null);
    setLocationFeedback(null);
    setAddressModalView("list");
    setIsAddressModalOpen(true);
  };

  const startNewAddress = () => {
    setEditingAddressId(null);
    setIsAddressDefaultDraft(savedAddressList.length === 0);
    setErrorMessage(null);
    setLocationFeedback(null);
    setForm((current) => ({
      ...defaultForm,
      customerName: current.customerName || initialUser.displayName,
      customerEmail: current.customerEmail || initialUser.email,
      countryCode: current.countryCode || canonicalizeCountryCode(initialCountryCode, defaultForm.countryCode),
      notes: current.notes,
    }));
    setAddressModalView("form");
    setIsAddressModalOpen(true);
  };

  const startEditAddress = (address: CustomerAddressRecord) => {
    setEditingAddressId(address.id);
    setIsAddressDefaultDraft(address.isDefault);
    setErrorMessage(null);
    setLocationFeedback(null);
    setForm((current) => ({
      ...current,
      ...buildFormFromAddress(address, initialUser),
      notes: current.notes,
    }));
    setAddressModalView("form");
    setIsAddressModalOpen(true);
  };

  const closeAddressModal = () => {
    if (savedAddressList.length === 0) {
      return;
    }

    setEditingAddressId(null);
    setAddressModalView("list");
    setIsAddressModalOpen(false);
    setErrorMessage(null);
    setLocationFeedback(null);
  };

  const selectSupportedCountry = (value: string) => {
    const normalized = canonicalizeCountryCode(value, "TG") as CountryCode;
    updateFormField("countryCode", normalized);
    setDeliveryMode("direct");
  };

  const hydrateAddressFromCoordinates = async (latitude: number, longitude: number) => {
    const mapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
    const response = await fetch(buildLocalUrl("/api/location/reverse-geocode"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ latitude, longitude }),
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload) {
      throw new Error(payload?.message || "Impossible de localiser cette position.");
    }

    const geocoded = payload as ReverseGeocodeResponse;
    const normalizedCountryCode = canonicalizeCountryCode(geocoded.countryCode, form.countryCode || "TG");
    setForm((current) => ({
      ...current,
      googleMapsUrl: mapsUrl,
      addressLine1: geocoded.addressLine1 || geocoded.displayName || current.addressLine1,
      addressLine2: geocoded.addressLine2 || current.addressLine2,
      city: geocoded.city || current.city,
      state: geocoded.state || geocoded.city || current.state,
      postalCode: geocoded.postalCode || current.postalCode,
      countryCode: normalizedCountryCode,
      customerAddressId: "",
    }));
    setLocationFeedback(`Adresse détectée: ${geocoded.displayName || [geocoded.city, geocoded.countryLabel].filter(Boolean).join(", ")}`);
  };

  const useCurrentPosition = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setErrorMessage("La géolocalisation n'est pas disponible sur cet appareil.");
      return;
    }

    setIsLocating(true);
    setErrorMessage(null);
    setLocationFeedback(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        void hydrateAddressFromCoordinates(position.coords.latitude, position.coords.longitude)
          .catch((error) => {
            setErrorMessage(error instanceof Error ? error.message : "Impossible de remplir l'adresse depuis votre position.");
          })
          .finally(() => {
            setIsLocating(false);
          });
      },
      () => {
        setIsLocating(false);
        setErrorMessage("Impossible d'accéder à votre position exacte.");
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  };

  const resolveMapsLink = async () => {
    let coordinates = extractCoordinatesFromGoogleMapsUrl(form.googleMapsUrl);

    if (!coordinates && isGoogleMapsShortUrl(form.googleMapsUrl)) {
      setIsResolvingMapsLink(true);
      setErrorMessage(null);
      setLocationFeedback(null);
      try {
        const response = await fetch(buildLocalUrl("/api/location/resolve-maps-link"), {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ url: form.googleMapsUrl }),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.coordinates) {
          throw new Error(payload?.message || "Impossible de lire ce lien Google Maps.");
        }

        coordinates = payload.coordinates;
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Impossible de lire cette position Maps.");
        setIsResolvingMapsLink(false);
        return;
      }
    }

    if (!coordinates) {
      setErrorMessage("Le lien Google Maps doit contenir des coordonnées exploitables.");
      return;
    }

    setIsResolvingMapsLink(true);
    setErrorMessage(null);
    setLocationFeedback(null);
    try {
      await hydrateAddressFromCoordinates(coordinates.latitude, coordinates.longitude);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Impossible de lire cette position Maps.");
    } finally {
      setIsResolvingMapsLink(false);
    }
  };

  const saveAddressFromModal = async () => {
    const recipientName = form.customerName.trim() || initialUser.displayName.trim();
    const phone = form.customerPhone.trim();
    const countryCode = canonicalizeCountryCode(form.countryCode, defaultForm.countryCode);
    const label = [getCountryDisplayLabel(countryCode), form.city.trim() || "Adresse"].filter(Boolean).join(" · ");

    if (!phone) {
      setErrorMessage("Le numéro de téléphone est obligatoire.");
      return;
    }

    if (requiresTransitAddress && !form.googleMapsUrl.trim()) {
      setErrorMessage("Ajoutez votre position actuelle Google Maps ou utilisez la localisation.");
      return;
    }

    if (!form.addressLine1.trim() || !form.city.trim() || !form.state.trim()) {
      setErrorMessage(requiresTransitAddress
        ? "Utilisez Google Maps pour remplir automatiquement l'adresse avant de confirmer."
        : "Tous les champs obligatoires de l'adresse doivent être renseignés.");
      return;
    }

    setIsSavingAddress(true);
    setErrorMessage(null);

    try {
      const endpoint = editingAddressId ? `/api/account/addresses/${editingAddressId}` : "/api/account/addresses";
      const method = editingAddressId ? "PUT" : "POST";
      const response = await fetch(endpoint, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          label,
          recipientName,
          phone,
          email: form.customerEmail.trim() || initialUser.email,
          addressLine1: form.addressLine1.trim(),
          addressLine2: form.addressLine2.trim() || undefined,
          city: form.city.trim(),
          state: form.state.trim(),
          postalCode: form.postalCode.trim() || undefined,
          countryCode,
          isDefault: isAddressDefaultDraft,
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.address) {
        throw new Error(payload?.message || "Impossible d'enregistrer l'adresse.");
      }

      const savedAddress = payload.address as CustomerAddressRecord;
      const nextAddresses = editingAddressId
        ? savedAddressList.map((address) => address.id === savedAddress.id ? savedAddress : address).map((address) => savedAddress.isDefault && address.id !== savedAddress.id ? { ...address, isDefault: false } : address)
        : [savedAddress, ...savedAddressList.map((address) => savedAddress.isDefault ? { ...address, isDefault: false } : address)];

      syncSavedAddresses(nextAddresses);
      applySavedAddress(savedAddress);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Impossible d'enregistrer l'adresse.");
    } finally {
      setIsSavingAddress(false);
    }
  };

  const submitOrder = async () => {
    if (items.length === 0 || !selectedOption) {
      return;
    }

    if (!form.customerName || !form.customerPhone) {
      setErrorMessage("Le nom et le téléphone sont obligatoires.");
      return;
    }

    if (deliveryMode === "direct" && !form.city) {
      setErrorMessage("La ville est obligatoire pour la livraison directe.");
      return;
    }

    if (deliveryMode === "forwarder" && !forwarderAddressBlock.trim()) {
      setErrorMessage("L'adresse bloc du transitaire est obligatoire.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const payload = await createOrder({
        ...form,
        ...(deliveryMode === "forwarder"
          ? {
              googleMapsUrl: undefined,
              addressLine1: forwarderAddressBlock.split(/\r?\n|,/).map((entry) => entry.trim()).filter(Boolean)[0] || "Adresse du transitaire en Chine",
              addressLine2: undefined,
              city: "Shenzhen",
              state: "Guangdong",
              postalCode: undefined,
              countryCode: "CN",
            }
          : {}),
        shippingMethod: selectedOption.key,
        items,
        deliveryProfile: deliveryPlan.deliveryProfile,
        promoCode: appliedPromo?.code,
        sharedCartToken: sharedCartContext?.token,
      });

      setIsSubmitting(false);
      clearCart();
      clearSharedCartContext();
      router.push(`/orders/payment?orderId=${encodeURIComponent(payload.order.id)}`);
    } catch (error) {
      setIsSubmitting(false);
      setErrorMessage(error instanceof Error ? error.message : "Impossible de créer la commande sourcing.");
    }
  };

  const applyPromoCode = useCallback(async (providedCode?: string) => {
    if (!selectedOption) {
      return;
    }

    const code = (providedCode ?? promoCodeInput).trim().toUpperCase();
    if (!code) {
      setPromoMessage("Saisissez un code promo.");
      return;
    }

    setIsApplyingPromo(true);
    setPromoMessage(null);
    try {
      const payload = await previewPromoCode(code, baseTotalPrice).catch((error) => ({
        message: error instanceof Error ? error.message : "Code promo invalide.",
      }));
      const promoCode = "promoCode" in payload ? payload.promoCode : undefined;
      if (!promoCode) {
        setAppliedPromo(null);
        setPromoMessage(typeof payload.message === "string" ? payload.message : "Code promo invalide.");
        return;
      }

      const discountFcfa = "discountFcfa" in payload && typeof payload.discountFcfa === "number" ? payload.discountFcfa : 0;
      const finalTotalFcfa = "finalTotalFcfa" in payload && typeof payload.finalTotalFcfa === "number"
        ? payload.finalTotalFcfa
        : baseTotalPrice;

      setAppliedPromo({
        code: promoCode.code,
        label: promoCode.label,
        discountFcfa,
        finalTotalFcfa,
        baseTotalFcfa: baseTotalPrice,
      });
      setPromoCodeInput(promoCode.code);
      setPromoMessage(`Code ${promoCode.code} appliqué.`);
    } finally {
      setIsApplyingPromo(false);
    }
  }, [baseTotalPrice, promoCodeInput, selectedOption]);

  useEffect(() => {
    const code = initialPromoCode?.trim().toUpperCase() ?? "";
    if (!code || hasAutoAppliedPromoRef.current || !selectedOption || isApplyingPromo) {
      return;
    }

    hasAutoAppliedPromoRef.current = true;
    setPromoCodeInput(code);
    void applyPromoCode(code);
  }, [applyPromoCode, initialPromoCode, isApplyingPromo, selectedOption]);

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
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_410px]">
      <div className="space-y-4">
        <section className="bg-white px-5 py-5 shadow-[0_1px_0_rgba(0,0,0,0.06)] sm:px-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[20px] font-bold tracking-[-0.03em] text-[#111827]">Adresse de livraison</div>
              <div className="mt-4 text-[18px] font-semibold text-[#111827]">
                {form.customerName || initialUser.displayName || "Nom du destinataire"}
                {form.customerPhone ? <span className="ml-4 font-medium text-[#344054]">{form.customerPhone}</span> : null}
              </div>
              <div className="mt-1 max-w-[780px] text-[15px] leading-7 text-[#475467]">{activeAddressSummary}</div>
              {deliveryPlan.deliveryProfile.unsupportedCountry ? (
                <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#fff4e8] px-4 py-2 text-[13px] font-semibold text-[#b45309]">
                  <AlertTriangle className="h-4 w-4" />
                  Nous passerons par un agent de transit
                </div>
              ) : null}
              {sharedCartContext ? (
                <div className="mt-3 text-[13px] font-medium text-[#1d4ed8]">
                  Panier partagé par {sharedCartContext.ownerDisplayName}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={openAddressSelector}
              className="inline-flex items-center gap-2 text-[16px] font-semibold text-[#2563eb] transition hover:text-[#1d4ed8]"
            >
              Changer
            </button>
          </div>

          {errorMessage ? <div className="mt-4 rounded-[18px] bg-[#fde8e8] px-4 py-4 text-[13px] font-semibold text-[#b42318]">{errorMessage}</div> : null}
          {locationFeedback ? <div className="mt-4 rounded-[18px] bg-[#eef6ff] px-4 py-4 text-[13px] font-semibold text-[#1d4f91]">{locationFeedback}</div> : null}
        </section>

        <section className="bg-white px-5 py-5 shadow-[0_1px_0_rgba(0,0,0,0.06)] sm:px-7">
          <div className="flex items-center justify-between gap-4">
            <div className="text-[20px] font-bold tracking-[-0.03em] text-[#111827]">Moyens de paiement</div>
          </div>

          <div className="mt-4 divide-y divide-[#eef2f6]">
            {paymentChoices.map((method) => (
              <button
                key={method.key}
                type="button"
                onClick={() => setSelectedPaymentMethod(method.key)}
                className="flex w-full items-start gap-4 py-5 text-left"
              >
                <div className={["mt-1 flex h-7 w-7 items-center justify-center rounded-full border", selectedPaymentMethod === method.key ? "border-[#2563eb] bg-white text-[#2563eb]" : "border-[#d0d5dd] bg-white text-transparent"].join(" ")}>
                  <Check className="h-4 w-4" />
                </div>
                <div
                  className={[
                    "mt-0.5 flex h-8 w-8 items-center justify-center rounded-[8px] text-[12px] font-black tracking-[-0.04em] ring-1 ring-black/5",
                    method.logoClassName,
                  ].join(" ")}
                >
                  <span>{method.logo}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[18px] font-semibold text-[#111827]">{method.title}</div>
                  <div className="mt-1 text-[13px] text-[#667085]">{method.subtitle}</div>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="bg-white px-5 py-5 shadow-[0_1px_0_rgba(0,0,0,0.06)] sm:px-7">
          <div className="flex items-center justify-between gap-4">
            <div className="text-[20px] font-bold tracking-[-0.03em] text-[#111827]">
              {isDirectAliExpressFlow ? "Expédié directement" : "Expédié par AfriPay"}
            </div>
            <div className="text-[16px] font-semibold text-[#2563eb]">{quote.items.length > 0 ? `Voir(${quote.items.length})` : null}</div>
          </div>

          <div className="mt-4 space-y-3">
            {shippingOptions.map((option) => {
              const Icon = option.key === "air" ? Truck : option.key === "sea" ? Ship : Truck;

              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => {
                    setHasUserSelectedShipping(true);
                    setSelectedShipping(option.key);
                  }}
                  className={[
                    "flex w-full items-start gap-3 rounded-[18px] border px-4 py-4 text-left transition",
                    selectedShipping === option.key ? "border-[#111827] bg-[#fafafa]" : "border-[#e5e7eb] bg-white hover:border-[#cbd5e1]",
                  ].join(" ")}
                >
                  <div className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-[12px] bg-[#f3f4f6] text-[#111827]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[16px] font-semibold text-[#111827]">{option.label}</div>
                      <div className="text-[16px] font-bold text-[#111827]">{option.isFree ? "gratuit" : formatSourcingAmount(option.priceFcfa, { currencyCode, locale })}</div>
                    </div>
                    <div className="mt-1 text-[13px] text-[#667085]">{formatShippingTradeLabel(option, { currencyCode, locale })}</div>
                    <div className="mt-1 text-[13px] text-[#667085]">Livraison : {option.deliveryWindow}</div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-5 space-y-4 border-t border-[#eef2f6] pt-5">
            {quote.items.map((item) => {
              const quantity = items.find((entry) => entry.slug === item.slug && JSON.stringify(entry.selectedVariants ?? {}) === JSON.stringify(item.selectedVariants ?? {}))?.quantity ?? item.quantity;

              return (
                <article key={item.cartKey ?? `${item.slug}-${item.selectionLabel ?? item.title}`} className="flex gap-4">
                  <div className="relative h-[112px] w-[112px] shrink-0 overflow-hidden rounded-[8px] bg-[#f8fafc] ring-1 ring-[#eceff3]">
                    <Image src={item.image} alt={item.title} fill sizes="112px" className="object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[18px] font-semibold tracking-[-0.03em] text-[#111827]">{item.title}</div>
                    {item.selectionLabel ? <div className="mt-1 text-[13px] text-[#667085]">{item.selectionLabel}</div> : null}
                    <div className="mt-2 text-[14px] font-semibold text-[#111827]">{formatSourcingAmount(item.finalUnitPriceFcfa, { currencyCode, locale })}</div>
                    <div className="mt-3 flex items-center gap-3">
                      <button type="button" onClick={() => updateItem(item.cartKey ?? item.slug, quantity - 1)} className="inline-flex h-8 w-8 items-center justify-center border border-[#d0d5dd] bg-white text-[#111827] transition hover:border-[#111827]">
                        <Minus className="h-4 w-4" />
                      </button>
                      <div className="min-w-[24px] text-center text-[18px] font-medium text-[#111827]">{quantity}</div>
                      <button type="button" onClick={() => updateItem(item.cartKey ?? item.slug, quantity + 1)} className="inline-flex h-8 w-8 items-center justify-center border border-[#d0d5dd] bg-white text-[#111827] transition hover:border-[#111827]">
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-3 text-[15px] font-semibold text-[#111827]">
                      Frais de livraison : {selectedOption?.isFree ? "Livraison gratuite" : selectedShippingLabel}
                    </div>
                    <div className="mt-1 text-[13px] text-[#667085]">Livraison : {selectedOption?.deliveryWindow ?? "A confirmer"}</div>
                    <div className="mt-1 text-[13px] text-[#667085]">Courrier company: Colissimo, Mondial Relay, Colis Privé, etc.</div>
                    <div className="mt-1 text-[13px] font-medium text-[#475467]">Poids : {item.weightKg.toFixed(2)} kg · Volume : {item.volumeCbm.toFixed(4)} CBM</div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>

      <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
        <section className="bg-white px-7 py-6 shadow-[0_1px_0_rgba(0,0,0,0.06)]">
          <div className="text-[20px] font-bold tracking-[-0.03em] text-[#111827]">Résumé</div>
          <div className="mt-6 space-y-5 text-[15px] text-[#111827]">
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold">Sous-total</span>
              <span className="text-[16px] font-bold">{formatSourcingAmount(quote.cartProductsTotalFcfa, { currencyCode, locale })}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold">Code promo</span>
              <button type="button" onClick={() => setIsPromoOpen((current) => !current)} className="inline-flex items-center gap-2 text-[15px] font-medium text-[#111827]">
                {appliedPromo ? appliedPromo.code : "Entrer le code ici"}
                <ChevronDown className={["h-4 w-4 transition", isPromoOpen ? "rotate-180" : ""].join(" ")} />
              </button>
            </div>
            {isPromoOpen ? (
              <div className="rounded-[16px] bg-[#f8fafc] p-4">
                <div className="flex flex-col gap-3">
                  <input value={promoCodeInput} onChange={(event) => setPromoCodeInput(event.target.value.toUpperCase())} placeholder="Entrer le code ici" className="h-11 w-full rounded-[14px] border border-[#d7dce5] bg-white px-4 text-[14px] text-[#111827] outline-none focus:border-[#111827]" />
                  <button type="button" onClick={() => void applyPromoCode()} disabled={isApplyingPromo || !selectedOption} className="inline-flex h-11 items-center justify-center rounded-full bg-[#111827] px-5 text-[14px] font-semibold text-white transition hover:bg-[#1f2937] disabled:cursor-not-allowed disabled:opacity-70">
                    {isApplyingPromo ? "Vérification..." : "Appliquer"}
                  </button>
                </div>
                {promoMessage ? <div className="mt-3 text-[12px] font-medium text-[#667085]">{promoMessage}</div> : null}
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold">Frais de livraison</span>
              <span className="inline-flex items-center gap-2 text-[16px] font-bold">
                {selectedOption?.isFree ? "gratuit" : selectedShippingLabel}
                <ChevronDown className="h-4 w-4" />
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold">Poids total</span>
              <span className="text-[16px] font-bold">{quote.totalWeightKg.toFixed(2)} kg</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold">Volume total</span>
              <span className="text-[16px] font-bold">{quote.totalCbm.toFixed(4)} CBM</span>
            </div>
          </div>

          <div className="mt-6 border-t border-[#eaecf0] pt-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="text-[18px] font-bold tracking-[-0.03em] text-[#111827]">Total</div>
                <div className="mt-1 inline-flex items-center gap-1 text-[14px] text-[#667085]">
                  TVA incluse
                  <CircleHelp className="h-4 w-4" />
                </div>
              </div>
              <div className="text-[22px] font-black tracking-[-0.05em] text-[#111827]">{formatSourcingAmount(totalPrice, { currencyCode, locale })}</div>
            </div>
          </div>

          <button type="button" onClick={submitOrder} disabled={isSubmitting || isLoading || !selectedOption} className="mt-6 inline-flex h-14 w-full items-center justify-center rounded-full bg-[#f00633] px-6 text-[16px] font-bold text-white transition hover:bg-[#d9042d] disabled:cursor-not-allowed disabled:opacity-70">
            {isSubmitting ? "Création en cours..." : "Commander"}
          </button>

          <p className="mt-5 text-[13px] leading-7 text-[#98a2b3]">
            En cliquant sur « Passer une commande », je confirme avoir lu et pris connaissance de toutes les{" "}
            <span className="font-semibold text-[#2563eb]">conditions et politiques</span>, ainsi que les{" "}
            <span className="font-semibold text-[#2563eb]">informations pour les consommateurs européens</span>.
          </p>
        </section>

        <section className="bg-white px-7 py-6 shadow-[0_1px_0_rgba(0,0,0,0.06)]">
          <div className="flex items-start gap-3">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-[12px] bg-[#f3f4f6] text-[#111827]">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <div className="text-[18px] font-bold tracking-[-0.03em] text-[#111827]">AfriPay</div>
              <div className="mt-2 text-[15px] leading-7 text-[#667085]">
                AfriPay protège vos informations personnelles et de paiement
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">
                <span className="rounded-full bg-[#f8fafc] px-3 py-1.5">SSL</span>
                <span className="rounded-full bg-[#f8fafc] px-3 py-1.5">Paiement sécurisé</span>
                <span className="rounded-full bg-[#f8fafc] px-3 py-1.5">Contrôle qualité</span>
              </div>
            </div>
          </div>
        </section>
      </aside>

      {isAddressModalOpen ? (
        <div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/55 px-4 py-8 sm:px-6">
          <div className="relative max-h-[calc(100vh-4rem)] w-full max-w-[1060px] overflow-y-auto rounded-[22px] bg-white shadow-[0_32px_80px_rgba(0,0,0,0.28)]">
            <button
              type="button"
              onClick={closeAddressModal}
              className="absolute right-5 top-5 inline-flex h-10 w-10 items-center justify-center rounded-full text-[#98a2b3] transition hover:bg-[#f4f4f5] hover:text-[#111827]"
            >
              <X className="h-6 w-6" />
            </button>

            {addressModalView === "list" ? (
              <div className="flex min-h-[620px] flex-col px-5 pb-6 pt-4 sm:px-8">
                <div className="border-b border-[#f0f2f5] pb-5 text-center text-[18px] font-bold text-[#111827]">Adresse de livraison</div>
                <div className="mt-6 flex-1 space-y-4">
                  {savedAddressList.length > 0 ? (
                    savedAddressList.map((address) => {
                      const isActive = form.customerAddressId === address.id;

                      return (
                        <div key={address.id} className="rounded-[16px] border border-[#d7dde5] px-4 py-5 sm:px-6">
                          <div className="flex items-start gap-4">
                            <button
                              type="button"
                              onClick={() => applySavedAddress(address)}
                              className="mt-5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-[#ff5533] text-[#ff5533]"
                            >
                              {isActive ? <div className="h-3.5 w-3.5 rounded-full bg-[#ff5533]" /> : null}
                            </button>
                            <button type="button" onClick={() => applySavedAddress(address)} className="min-w-0 flex-1 text-left">
                              <div className="flex flex-wrap items-center gap-3">
                                <span className="text-[16px] font-bold text-[#111827]">{address.recipientName}</span>
                                <span className="text-[16px] text-[#98a2b3]">{address.phone}</span>
                              </div>
                              <div className="mt-1 text-[16px] leading-8 text-[#475467]">{formatSavedAddress(address)}</div>
                              {address.isDefault ? <div className="mt-4 inline-flex rounded-[8px] bg-[#fff1f0] px-4 py-1 text-[12px] font-medium text-[#ff5533]">Par défaut</div> : null}
                            </button>
                            <button type="button" onClick={() => startEditAddress(address)} className="text-[16px] font-medium text-[#2563eb] transition hover:text-[#1d4ed8]">
                              Modifier
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-[16px] border border-dashed border-[#d7dde5] px-6 py-14 text-center text-[15px] text-[#667085]">
                      Aucune adresse enregistrée pour le moment.
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={startNewAddress}
                  className="mx-auto mt-6 inline-flex h-13 w-full max-w-[460px] items-center justify-center rounded-full bg-[#ff334d] px-6 text-[17px] font-bold text-white transition hover:bg-[#f00633]"
                >
                  Ajouter une nouvelle adresse
                </button>
              </div>
            ) : (
              <div className="px-5 pb-8 pt-4 sm:px-9">
                <div className="border-b border-[#f0f2f5] pb-5 text-center text-[18px] font-bold text-[#111827]">
                  {editingAddressId ? "Modifier l'adresse" : "Ajouter une nouvelle adresse"}
                </div>

                <div className="mt-7">
                  <div className="text-[16px] font-bold text-[#111827]">Informations personnelles</div>
                  <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr_1.1fr]">
                    <label className="text-[13px] font-semibold text-[#344054]">
                      Nom complet
                      <input value={form.customerName} onChange={(event) => updateFormField("customerName", event.target.value)} placeholder="Nom complet*" className="mt-2 h-13 w-full rounded-[10px] border border-[#d7dce5] px-4 text-[16px] text-[#111827] outline-none focus:border-[#111827]" />
                    </label>
                    <label className="text-[13px] font-semibold text-[#344054]">
                      Email
                      <input value={form.customerEmail} onChange={(event) => updateFormField("customerEmail", event.target.value)} type="email" autoComplete="email" placeholder="Email*" className="mt-2 h-13 w-full rounded-[10px] border border-[#d7dce5] px-4 text-[16px] text-[#111827] outline-none focus:border-[#111827]" />
                    </label>
                    <label className="text-[13px] font-semibold text-[#344054]">
                      Téléphone
                      <input value={form.customerPhone} onChange={(event) => updateFormField("customerPhone", event.target.value)} autoComplete="tel" placeholder="Numéro de téléphone*" className="mt-2 h-13 w-full rounded-[10px] border border-[#d7dce5] px-4 text-[16px] text-[#111827] outline-none focus:border-[#111827]" />
                    </label>
                  </div>
                </div>

                <div className="mt-7">
                  <div className="text-[16px] font-bold text-[#111827]">
                    {requiresTransitAddress ? "Adresse actuelle" : "Adresse"}
                  </div>

                  {requiresTransitAddress ? (
                    <div className="mt-4 space-y-4">
                      <div className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
                        <label className="text-[13px] font-semibold text-[#344054]">
                          Ma position actuelle Google Maps
                          <input value={form.googleMapsUrl} onChange={(event) => updateFormField("googleMapsUrl", event.target.value)} placeholder="https://www.google.com/maps?q=..." className="mt-2 h-13 w-full rounded-[10px] border border-[#d7dce5] px-4 text-[15px] text-[#111827] outline-none focus:border-[#111827]" />
                        </label>
                        <div className="grid gap-2 pt-0 lg:pt-7">
                          <button type="button" onClick={resolveMapsLink} disabled={isResolvingMapsLink || !form.googleMapsUrl.trim()} className="inline-flex h-13 items-center justify-center rounded-[10px] border border-[#d7dce5] px-4 text-[14px] font-semibold text-[#111827] transition hover:border-[#111827] disabled:cursor-not-allowed disabled:opacity-60">{isResolvingMapsLink ? "Lecture du lien..." : "Lire le lien"}</button>
                          <button type="button" onClick={useCurrentPosition} disabled={isLocating} className="inline-flex h-13 items-center justify-center gap-2 rounded-[10px] bg-[#111827] px-4 text-[14px] font-semibold text-white transition hover:bg-[#1f2937] disabled:cursor-not-allowed disabled:opacity-70"><LocateFixed className="h-4 w-4" />{isLocating ? "Localisation..." : "Utiliser ma position"}</button>
                        </div>
                      </div>
                      <div className="grid gap-4 lg:grid-cols-2">
                        <label className="text-[13px] font-semibold text-[#344054]">
                          Pays détecté
                          <input value={getCountryDisplayLabel(form.countryCode)} readOnly className="mt-2 h-13 w-full rounded-[10px] border border-[#e4e7ec] bg-[#f8fafc] px-4 text-[15px] text-[#667085] outline-none" />
                        </label>
                        <label className="text-[13px] font-semibold text-[#344054]">
                          Ville détectée
                          <input value={form.city} readOnly className="mt-2 h-13 w-full rounded-[10px] border border-[#e4e7ec] bg-[#f8fafc] px-4 text-[15px] text-[#667085] outline-none" />
                        </label>
                        <label className="lg:col-span-2 text-[13px] font-semibold text-[#344054]">
                          Adresse détectée
                          <input value={quickAddress} readOnly className="mt-2 h-13 w-full rounded-[10px] border border-[#e4e7ec] bg-[#f8fafc] px-4 text-[15px] text-[#667085] outline-none" />
                        </label>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 space-y-4">
                      <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr_0.9fr_1fr]">
                        <label className="text-[13px] font-semibold text-[#344054]">
                          Pays
                          <select value={isSupportedDirectDeliveryCountry(form.countryCode) || usesInternalReceptionAddress ? form.countryCode : DELIVERY_COUNTRY_OPTIONS[0]?.code} onChange={(event) => selectSupportedCountry(event.target.value)} className="mt-2 h-13 w-full rounded-[10px] border border-[#d7dce5] bg-white px-4 text-[16px] text-[#111827] outline-none focus:border-[#111827]">
                            {DELIVERY_COUNTRY_OPTIONS.map((country) => (
                              <option key={country.code} value={country.code}>{country.flagEmoji} {country.label}</option>
                            ))}
                          </select>
                        </label>
                        <label className="text-[13px] font-semibold text-[#344054]">
                          Code postal
                          <input value={form.postalCode} onChange={(event) => updateFormField("postalCode", event.target.value)} placeholder="Code postal*" className="mt-2 h-13 w-full rounded-[10px] border border-[#d7dce5] px-4 text-[16px] text-[#111827] outline-none focus:border-[#111827]" />
                        </label>
                        <label className="text-[13px] font-semibold text-[#344054]">
                          Région / État
                          <input value={form.state} onChange={(event) => updateFormField("state", event.target.value)} placeholder="Région*" className="mt-2 h-13 w-full rounded-[10px] border border-[#d7dce5] px-4 text-[16px] text-[#111827] outline-none focus:border-[#111827]" />
                        </label>
                        <label className="text-[13px] font-semibold text-[#344054]">
                          Ville
                          <input value={form.city} onChange={(event) => updateFormField("city", event.target.value)} placeholder="Ville*" className="mt-2 h-13 w-full rounded-[10px] border border-[#d7dce5] px-4 text-[16px] text-[#111827] outline-none focus:border-[#111827]" />
                        </label>
                      </div>
                      <div className="grid gap-4 lg:grid-cols-2">
                        <label className="text-[13px] font-semibold text-[#344054]">
                          Numéro et nom de la rue
                          <input value={form.addressLine1} onChange={(event) => updateFormField("addressLine1", event.target.value)} placeholder="Numéro et nom de la rue" className="mt-2 h-13 w-full rounded-[10px] border border-[#d7dce5] px-4 text-[16px] text-[#111827] outline-none focus:border-[#111827]" />
                        </label>
                        <label className="text-[13px] font-semibold text-[#344054]">
                          Appartement, suite, unité, etc. (facultatif)
                          <input value={form.addressLine2} onChange={(event) => updateFormField("addressLine2", event.target.value)} placeholder="Appartement, suite, unité, etc. (facultatif)" className="mt-2 h-13 w-full rounded-[10px] border border-[#d7dce5] px-4 text-[16px] text-[#111827] outline-none focus:border-[#111827]" />
                        </label>
                      </div>
                    </div>
                  )}

                  <label className="mt-6 inline-flex items-center gap-3 text-[15px] text-[#111827]">
                    <input type="checkbox" checked={isAddressDefaultDraft} onChange={(event) => setIsAddressDefaultDraft(event.target.checked)} className="h-6 w-6 rounded-[6px] border border-[#cbd5e1]" />
                    Définir en tant qu&apos;adresse de livraison par défaut
                  </label>

                  {errorMessage ? <div className="mt-4 rounded-[14px] bg-[#fde8e8] px-4 py-3 text-[13px] font-semibold text-[#b42318]">{errorMessage}</div> : null}
                  {locationFeedback ? <div className="mt-4 rounded-[14px] bg-[#eef6ff] px-4 py-3 text-[13px] font-semibold text-[#1d4f91]">{locationFeedback}</div> : null}

                  <div className="mt-8 flex flex-wrap items-center gap-4">
                    <button type="button" onClick={saveAddressFromModal} disabled={isSavingAddress} className="inline-flex h-13 min-w-[220px] items-center justify-center rounded-full bg-[#ff334d] px-8 text-[18px] font-bold text-white transition hover:bg-[#f00633] disabled:cursor-not-allowed disabled:opacity-70">
                      {isSavingAddress ? "Enregistrement..." : "Confirmer"}
                    </button>
                    <button type="button" onClick={() => setAddressModalView("list")} className="inline-flex h-13 min-w-[220px] items-center justify-center rounded-full border border-[#cbd5e1] bg-white px-8 text-[18px] font-semibold text-[#111827] transition hover:border-[#111827]">
                      Annuler
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
