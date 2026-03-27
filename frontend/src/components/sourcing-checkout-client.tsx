"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, LocateFixed, MapPinned, Ship, ShoppingCart, Truck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useCart, useCartQuote } from "@/components/cart-provider";
import { buildLocalUrl, createOrder, previewPromoCode } from "@/lib/api";
import {
  formatShippingTradeLabel,
  formatSourcingAmount,
  resolveSourcingDeliveryPlan,
  SUPPORTED_DIRECT_DELIVERY_COUNTRY_CODES,
  type SourcingDeliveryMode,
  type ShippingMethodKey,
} from "@/lib/alibaba-sourcing";
import { buildAddressQuickInput } from "@/lib/address-autofill";
import { canonicalizeCountryCode, getCountryDisplayLabel } from "@/lib/country-utils";
import type { CustomerAddressRecord } from "@/lib/customer-addresses";
import { extractCoordinatesFromGoogleMapsUrl, isGoogleMapsShortUrl } from "@/lib/google-maps";
import { COUNTRY_CONFIG, type CountryCode } from "@/lib/pricing-options";

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
  currencyCode: string;
  locale: string;
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

const SUPPORTED_DELIVERY_COUNTRIES = SUPPORTED_DIRECT_DELIVERY_COUNTRY_CODES.map((code) => ({
  code,
  label: COUNTRY_CONFIG[code].countryLabel,
  flagEmoji: COUNTRY_CONFIG[code].flagEmoji,
}));

function isSupportedDirectCountry(code: string) {
  const normalizedCode = canonicalizeCountryCode(code);
  return SUPPORTED_DIRECT_DELIVERY_COUNTRY_CODES.includes(normalizedCode as (typeof SUPPORTED_DIRECT_DELIVERY_COUNTRY_CODES)[number]);
}

export function SourcingCheckoutClient({ initialUser, savedAddresses, currencyCode, locale }: SourcingCheckoutClientProps) {
  const { items, clearCart, sharedCartContext, clearSharedCartContext } = useCart();
  const router = useRouter();
  const defaultAddress = savedAddresses.find((address) => address.isDefault) ?? savedAddresses[0];
  const [form, setForm] = useState({
    ...defaultForm,
    customerName: initialUser.displayName,
    customerEmail: initialUser.email,
    ...(defaultAddress ? buildFormFromAddress(defaultAddress, initialUser) : {}),
  });
  const [deliveryMode, setDeliveryMode] = useState<SourcingDeliveryMode>("direct");
  const [forwarderAddressBlock, setForwarderAddressBlock] = useState("");
  const [forwarderParcelMarking, setForwarderParcelMarking] = useState("");
  const [useExternalCountryFlow, setUseExternalCountryFlow] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [promoCodeInput, setPromoCodeInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; label: string; discountFcfa: number; finalTotalFcfa: number; baseTotalFcfa: number } | null>(null);
  const [promoMessage, setPromoMessage] = useState<string | null>(null);
  const [isApplyingPromo, setIsApplyingPromo] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isResolvingMapsLink, setIsResolvingMapsLink] = useState(false);
  const [locationFeedback, setLocationFeedback] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasUserSelectedShipping, setHasUserSelectedShipping] = useState(false);
  const [selectedShipping, setSelectedShipping] = useState<ShippingMethodKey>("air");

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

  useEffect(() => {
    if (deliveryPlan.deliveryProfile.mode === "forwarder" && deliveryMode !== "forwarder") {
      setDeliveryMode("forwarder");
    }
  }, [deliveryMode, deliveryPlan.deliveryProfile.mode]);

  const selectedOption = useMemo(() => shippingOptions.find((option) => option.key === selectedShipping) ?? shippingOptions[0] ?? null, [selectedShipping, shippingOptions]);
  const baseTotalPrice = quote.cartProductsTotalFcfa + (selectedOption?.priceFcfa ?? 0);
  const totalPrice = appliedPromo?.baseTotalFcfa === baseTotalPrice ? appliedPromo.finalTotalFcfa : baseTotalPrice;
  const quickAddress = useMemo(() => buildAddressQuickInput(form), [form]);

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
    const shouldUseForwarder = !isSupportedDirectCountry(nextAddress.countryCode);
    setUseExternalCountryFlow(shouldUseForwarder);
    setDeliveryMode(shouldUseForwarder ? "forwarder" : "direct");
    setLocationFeedback(null);
  };

  const selectSupportedCountry = (value: string) => {
    const normalized = canonicalizeCountryCode(value, "TG") as CountryCode;
    updateFormField("countryCode", normalized);
    setUseExternalCountryFlow(false);
    if (deliveryMode !== "forwarder") {
      setDeliveryMode("direct");
    }
  };

  const enableExternalCountryFlow = () => {
    setUseExternalCountryFlow(true);
    setDeliveryMode("forwarder");
    setErrorMessage(null);
    setLocationFeedback("Utilisez un agent en Chine. AfriPay livre jusqu'a votre agent et la commande sera close des la remise.");
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

    if (!deliveryPlan.supported) {
      setErrorMessage(deliveryPlan.unsupportedMessage ?? "Cette adresse n'est pas prise en charge en livraison directe.");
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

  const applyPromoCode = async () => {
    if (!promoCodeInput.trim()) {
      setPromoMessage("Saisissez un code promo.");
      return;
    }

    setIsApplyingPromo(true);
    setPromoMessage(null);
    try {
      const payload = await previewPromoCode(promoCodeInput, baseTotalPrice).catch((error) => ({
        message: error instanceof Error ? error.message : "Code promo invalide.",
      }));
      if (!payload?.promoCode) {
        setAppliedPromo(null);
        setPromoMessage(typeof payload?.message === "string" ? payload.message : "Code promo invalide.");
        return;
      }

      setAppliedPromo({
        code: payload.promoCode.code,
        label: payload.promoCode.label,
        discountFcfa: payload.discountFcfa,
        finalTotalFcfa: payload.finalTotalFcfa,
        baseTotalFcfa: baseTotalPrice,
      });
      setPromoCodeInput(payload.promoCode.code);
      setPromoMessage(`Code ${payload.promoCode.code} appliqué.`);
    } finally {
      setIsApplyingPromo(false);
    }
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
    <div className="grid gap-6 xl:grid-cols-[1.04fr_0.96fr]">
      <section className="rounded-[30px] border border-[#ece7df] bg-white p-5 shadow-[0_16px_40px_rgba(17,24,39,0.05)] sm:p-7">
        <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#ff6a00]">Checkout sourcing</div>
        <h1 className="mt-2 text-[26px] font-black tracking-[-0.05em] text-[#1f2937] sm:text-[30px]">Adresse, agent et livraison finale</h1>
        <p className="mt-3 text-[13px] leading-6 text-[#667085] sm:text-[14px]">Choisissez un pays livré directement par AfriPay. Si votre pays n&apos;est pas dans la liste, passez par votre agent en Chine.</p>

        {sharedCartContext ? (
          <div className="mt-5 rounded-[18px] border border-[#d8e5fb] bg-[#eef6ff] px-4 py-4 text-[13px] leading-6 text-[#1d4f91]">
            Vous validez un panier créé par <span className="font-semibold">{sharedCartContext.ownerDisplayName}</span>. La commande sera gérée depuis votre compte payeur, avec mention claire du créateur tiers dans l’historique.
          </div>
        ) : null}

        <div className="mt-5 rounded-[24px] bg-[linear-gradient(135deg,#fff7ef_0%,#ffffff_52%,#eef6ff_100%)] p-4 ring-1 ring-[#f1ddcd] sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#d85300]">Carnet d&apos;adresses</div>
              <div className="mt-1 text-[13px] text-[#5f534a] sm:text-[14px]">Sélectionnez une adresse existante ou saisissez une nouvelle destination.</div>
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
                    <div className="mt-1 text-[13px] leading-6 text-[#6b7280]">{formatSavedAddress(address)}</div>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        {errorMessage ? <div className="mt-4 rounded-[18px] bg-[#fde8e8] px-4 py-4 text-[13px] font-semibold text-[#b42318]">{errorMessage}</div> : null}
        {locationFeedback ? <div className="mt-4 rounded-[18px] bg-[#eef6ff] px-4 py-4 text-[13px] font-semibold text-[#1d4f91]">{locationFeedback}</div> : null}

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <label className="text-[13px] font-semibold text-[#344054]">
            Nom complet
            <input value={form.customerName} onChange={(event) => updateFormField("customerName", event.target.value)} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] text-[#111827] outline-none focus:border-[#ff6a00]" />
          </label>
          <label className="text-[13px] font-semibold text-[#344054]">
            Email
            <input value={form.customerEmail} onChange={(event) => updateFormField("customerEmail", event.target.value)} type="email" autoComplete="email" className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] text-[#111827] outline-none focus:border-[#ff6a00]" />
          </label>
          <label className="text-[13px] font-semibold text-[#344054]">
            Téléphone (WhatsApp)
            <input value={form.customerPhone} onChange={(event) => updateFormField("customerPhone", event.target.value)} autoComplete="tel" className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] text-[#111827] outline-none focus:border-[#ff6a00]" />
          </label>

          <div className="sm:col-span-3 rounded-[20px] border border-[#dce3ec] bg-[#fbfcfe] p-4 sm:rounded-[24px] sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#ff6a00]">Mode de livraison</div>
                <div className="mt-1 text-[13px] text-[#667085] sm:text-[14px]">Livraison directe sur pays supportés ou livraison via votre agent en Chine.</div>
              </div>
              <div className="inline-flex rounded-full bg-[#eef2f6] p-1">
                <button type="button" onClick={() => setDeliveryMode("direct")} className={["rounded-full px-4 py-2 text-[13px] font-semibold transition", deliveryMode === "direct" ? "bg-white text-[#111827] shadow-[0_4px_14px_rgba(15,23,42,0.08)]" : "text-[#667085]"].join(" ")}>Livraison directe</button>
                <button type="button" onClick={() => {
                  setDeliveryMode("forwarder");
                  setUseExternalCountryFlow(true);
                }} className={["rounded-full px-4 py-2 text-[13px] font-semibold transition", deliveryMode === "forwarder" ? "bg-white text-[#111827] shadow-[0_4px_14px_rgba(15,23,42,0.08)]" : "text-[#667085]"].join(" ")}>Agent en Chine</button>
              </div>
            </div>

            {deliveryMode === "direct" ? (
              <>
                <div className="mt-5 grid gap-4 sm:grid-cols-[1.3fr_0.7fr]">
              <label className="text-[13px] font-semibold text-[#344054]">
                Lien Google Maps
                <input value={form.googleMapsUrl} onChange={(event) => updateFormField("googleMapsUrl", event.target.value)} placeholder="https://www.google.com/maps?q=..." className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] text-[#111827] outline-none focus:border-[#ff6a00]" />
              </label>
              <div className="grid gap-2 sm:pt-[26px]">
                <button type="button" onClick={resolveMapsLink} disabled={isResolvingMapsLink || !form.googleMapsUrl.trim()} className="inline-flex h-11 items-center justify-center rounded-full border border-[#d7dce5] px-4 text-[13px] font-semibold text-[#344054] transition hover:border-[#ff6a00] hover:text-[#ff6a00] disabled:cursor-not-allowed disabled:opacity-60">{isResolvingMapsLink ? "Lecture du lien..." : "Lire le lien"}</button>
                <button type="button" onClick={useCurrentPosition} disabled={isLocating} className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#143743] px-4 text-[13px] font-semibold text-white transition hover:bg-[#102d36] disabled:cursor-not-allowed disabled:opacity-70"><LocateFixed className="h-4 w-4" />{isLocating ? "Localisation..." : "Ma position actuelle"}</button>
              </div>
            </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-[13px] font-semibold text-[#344054]">
                Ville
                <input value={form.city} onChange={(event) => updateFormField("city", event.target.value)} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] text-[#111827] outline-none focus:border-[#ff6a00]" />
              </label>
              <label className="sm:col-span-2 text-[13px] font-semibold text-[#344054]">
                Adresse exacte
                <input value={form.addressLine1} onChange={(event) => updateFormField("addressLine1", event.target.value)} autoComplete="address-line1" className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] text-[#111827] outline-none focus:border-[#ff6a00]" />
              </label>
              <label className="text-[13px] font-semibold text-[#344054]">
                Pays de livraison supporté
                <select value={isSupportedDirectCountry(form.countryCode) ? form.countryCode : SUPPORTED_DELIVERY_COUNTRIES[0]?.code} onChange={(event) => selectSupportedCountry(event.target.value)} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] bg-white px-4 text-[14px] text-[#111827] outline-none focus:border-[#ff6a00]">
                  {SUPPORTED_DELIVERY_COUNTRIES.map((country) => (
                    <option key={country.code} value={country.code}>{country.flagEmoji} {country.label}</option>
                  ))}
                </select>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] font-medium text-[#667085]">
                  <span>Votre pays n&apos;est pas dans la liste ?</span>
                  <button type="button" onClick={enableExternalCountryFlow} className="inline-flex items-center justify-center rounded-full border border-[#d7dce5] px-3 py-1 text-[12px] font-semibold text-[#111827] transition hover:border-[#ff6a00] hover:text-[#ff6a00]">Cliquez ici</button>
                </div>
              </label>
              <label className="text-[13px] font-semibold text-[#344054]">
                Région / État
                <input value={form.state} onChange={(event) => updateFormField("state", event.target.value)} autoComplete="address-level1" className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] text-[#111827] outline-none focus:border-[#ff6a00]" />
              </label>
              {useExternalCountryFlow ? (
                <label className="sm:col-span-2 text-[13px] font-semibold text-[#344054]">
                  Votre pays / code pays
                  <input value={form.countryCode} onChange={(event) => updateFormField("countryCode", canonicalizeCountryCode(event.target.value, form.countryCode || "TG"))} autoComplete="country" placeholder="Ex: NG, SN, ML ou Togo" className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] uppercase text-[#111827] outline-none focus:border-[#ff6a00]" />
                </label>
              ) : null}
              <label className="sm:col-span-2 text-[13px] font-semibold text-[#344054]">
                Résumé détecté
                <input value={quickAddress} readOnly className="mt-2 h-11 w-full rounded-[14px] border border-[#e3e8ef] bg-[#f8fafc] px-4 text-[13px] text-[#667085] outline-none" />
              </label>
                </div>
              </>
            ) : null}

            {deliveryPlan.deliveryProfile.unsupportedCountry && deliveryMode !== "forwarder" ? (
              <div className="mt-4 rounded-[18px] border border-[#f8d7a6] bg-[#fff8ee] px-4 py-4 text-[13px] leading-6 text-[#8a4b16]">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <div className="font-semibold">{deliveryPlan.deliveryProfile.unsupportedMessage}</div>
                    <div className="mt-1">Utilisez un agent en Chine. AfriPay n&apos;applique pas la livraison gratuite et la commande sera considérée livrée dès remise à votre agent.</div>
                    <button type="button" onClick={() => setDeliveryMode("forwarder")} className="mt-3 inline-flex h-10 items-center justify-center rounded-full bg-[#111827] px-4 text-[13px] font-semibold text-white transition hover:bg-[#1f2937]">Mettre l&apos;adresse du transitaire</button>
                  </div>
                </div>
              </div>
            ) : null}

            {deliveryMode === "forwarder" ? (
              <div className="mt-4 rounded-[20px] border border-[#dbe7f5] bg-[#f6fbff] p-4">
                <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#1d4f91]">Agent en Chine</div>
                <div className="mt-1 text-[13px] text-[#56708d] sm:text-[14px]">Collez l&apos;adresse complète fournie par votre agent en Chine puis ajoutez le marquage du colis.</div>
                <div className="mt-4 grid gap-4">
                  <label className="text-[13px] font-semibold text-[#344054]">
                    Adresse complète du transitaire
                    <textarea value={forwarderAddressBlock} onChange={(event) => setForwarderAddressBlock(event.target.value)} placeholder="Collez ici le bloc d&apos;adresse complet donné par votre agent" className="mt-2 min-h-[120px] w-full rounded-[18px] border border-[#d7dce5] px-4 py-3 text-[14px] text-[#111827] outline-none focus:border-[#1d4f91]" />
                  </label>
                  <label className="text-[13px] font-semibold text-[#344054]">
                    Informations à mettre sur le colis
                    <input value={forwarderParcelMarking} onChange={(event) => setForwarderParcelMarking(event.target.value)} placeholder="Nom, code client, numéro, référence..." className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] text-[#111827] outline-none focus:border-[#1d4f91]" />
                  </label>
                </div>
                <div className="mt-4 rounded-[16px] bg-white px-4 py-3 text-[13px] leading-6 text-[#43556c] ring-1 ring-[#dbe7f5]">
                  Adresse agent Chine sélectionnée: AfriPay n&apos;applique pas la livraison gratuite et la commande sera clôturée dès remise au transitaire.
                </div>
              </div>
            ) : null}
          </div>

          <label className="sm:col-span-3 text-[13px] font-semibold text-[#344054]">
            Note de commande
            <textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} className="mt-2 min-h-[120px] w-full rounded-[18px] border border-[#d7dce5] px-4 py-3 text-[14px] text-[#111827] outline-none focus:border-[#ff6a00]" />
          </label>
        </div>
      </section>

      <aside className="space-y-4">
        <section className="rounded-[28px] border border-[#ece7df] bg-white p-5 shadow-[0_16px_40px_rgba(17,24,39,0.05)]">
          <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#ff6a00]">Prix et transport</div>
          <div className="mt-2 text-[24px] font-black tracking-[-0.05em] text-[#1f2937]">{formatSourcingAmount(quote.cartProductsTotalFcfa, { currencyCode, locale })}</div>
          <div className="mt-2 text-[13px] text-[#667085]">Produits finalisés avec marge, hors transport.</div>
          <div className="mt-4 rounded-[18px] bg-[#f8fafc] px-4 py-3 text-[13px] font-medium text-[#475467]">
            {deliveryPlan.workflow.freeDeliveryEligible
              ? quote.freeShippingMessage
              : "Mode transitaire: aucune livraison gratuite AfriPay. Seuls les frais jusqu'à votre agent sont calculés."}
          </div>
        </section>

        <section className="rounded-[28px] border border-[#ece7df] bg-white p-5 shadow-[0_16px_40px_rgba(17,24,39,0.05)]">
          <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#ff6a00]">Choix de livraison</div>
          {deliveryMode === "direct" && quote.recommendedMethod === "sea" ? <div className="mt-3 rounded-[18px] bg-[#eef6ff] px-4 py-3 text-[13px] font-medium text-[#1d4f91]">Au-dessus de 1 kg, le bateau est recommandé et l&apos;avion reste disponible si vous voulez payer l&apos;express.</div> : null}
          {deliveryMode === "forwarder" ? <div className="mt-3 rounded-[18px] bg-[#eef6ff] px-4 py-3 text-[13px] font-medium text-[#1d4f91]">Pour une adresse agent en Chine, seul le fret local fournisseur -&gt; transitaire est facturé.</div> : null}
          <div className="mt-4 space-y-3">
            {shippingOptions.map((option) => {
              const Icon = option.key === "air" ? Truck : option.key === "sea" ? Ship : Truck;

              return (
                <button key={option.key} type="button" onClick={() => {
                  setHasUserSelectedShipping(true);
                  setSelectedShipping(option.key);
                }} className={["flex w-full items-start gap-3 rounded-[20px] border px-4 py-4 text-left transition", selectedShipping === option.key ? "border-[#ff6a00] bg-[#fff5ed]" : "border-[#e6eaf0] bg-white hover:border-[#ffb48a]"].join(" ")}>
                  <div className={["mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-[14px]", option.key === "air" ? "bg-[#fff0e6] text-[#ff6a00]" : option.key === "sea" ? "bg-[#eaf3ff] text-[#2f67f6]" : "bg-[#eef6ff] text-[#1d4f91]"].join(" ")}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[16px] font-semibold text-[#1f2937]">{option.label}</div>
                      <div className="text-[16px] font-black tracking-[-0.03em] text-[#1f2937]">{option.isFree ? "Gratuite" : formatSourcingAmount(option.priceFcfa, { currencyCode, locale })}</div>
                    </div>
                    <div className="mt-1 text-[13px] text-[#667085]">{formatShippingTradeLabel(option, { currencyCode, locale })}</div>
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
            <div className="text-[16px] font-bold text-[#1f2937]">{formatSourcingAmount(quote.cartProductsTotalFcfa, { currencyCode, locale })}</div>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <div className="text-[16px] font-semibold text-[#1f2937]">{deliveryMode === "forwarder" ? "Fret" : "Livraison"}</div>
            <div className="text-[16px] font-bold text-[#1f2937]">{selectedOption ? (selectedOption.isFree ? "Gratuite" : formatSourcingAmount(selectedOption.priceFcfa, { currencyCode, locale })) : formatSourcingAmount(0, { currencyCode, locale })}</div>
          </div>
          <div className="mt-3 flex items-center justify-between text-[13px] text-[#667085]">
            <span>Poids total</span>
            <span>{quote.totalWeightKg.toFixed(3)} kg</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-[13px] text-[#667085]">
            <span>Volume total</span>
            <span>{quote.totalCbm.toFixed(4)} CBM</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-[13px] text-[#667085]">
            <span>Route logistique</span>
            <span>{deliveryPlan.workflow.routeType === "customer-forwarder" ? "Fournisseur -> transitaire Chine" : "Livraison AfriPay"}</span>
          </div>
          <div className="mt-4 rounded-[18px] border border-[#edf1f6] bg-[#f8fafc] p-4">
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#ff6a00]">Code promo</div>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <input value={promoCodeInput} onChange={(event) => setPromoCodeInput(event.target.value.toUpperCase())} placeholder="Ex: WELCOME10" className="h-11 flex-1 rounded-[14px] border border-[#d7dce5] bg-white px-4 text-[14px] text-[#111827] outline-none focus:border-[#ff6a00]" />
              <button type="button" onClick={applyPromoCode} disabled={isApplyingPromo || !selectedOption} className="inline-flex h-11 items-center justify-center rounded-full bg-[#143743] px-5 text-[13px] font-semibold text-white transition hover:bg-[#102d36] disabled:cursor-not-allowed disabled:opacity-70">
                {isApplyingPromo ? "Vérification..." : "Appliquer"}
              </button>
            </div>
            {promoMessage ? <div className="mt-3 text-[12px] font-medium text-[#475467]">{promoMessage}</div> : null}
          </div>
          {appliedPromo?.baseTotalFcfa === baseTotalPrice ? (
            <div className="mt-3 flex items-center justify-between text-[15px] font-semibold text-[#1d4f91]">
              <span>Réduction {appliedPromo.code}</span>
              <span>-{formatSourcingAmount(appliedPromo.discountFcfa, { currencyCode, locale })}</span>
            </div>
          ) : null}
          <div className="mt-4 border-t border-[#edf1f6] pt-4">
            <div className="flex items-center justify-between">
              <div className="text-[18px] font-black tracking-[-0.04em] text-[#1f2937]">Total</div>
              <div className="text-[22px] font-black tracking-[-0.05em] text-[#1f2937]">{formatSourcingAmount(totalPrice, { currencyCode, locale })}</div>
            </div>
          </div>
          {deliveryPlan.workflow.routeType === "customer-forwarder" ? (
            <div className="mt-4 rounded-[18px] bg-[#fff8ee] px-4 py-4 text-[13px] leading-6 text-[#8a4b16] ring-1 ring-[#f6deb5]">
              La commande sera clôturée dès remise au transitaire.
            </div>
          ) : null}
          <button type="button" onClick={submitOrder} disabled={isSubmitting || isLoading || !selectedOption} className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-full bg-[#ff6a00] px-6 text-[15px] font-semibold text-white transition hover:bg-[#e55e00] disabled:cursor-not-allowed disabled:opacity-70">
            {isSubmitting ? "Création en cours..." : "Continuer vers le paiement"}
          </button>
          <Link href="/cart" className="mt-3 inline-flex h-12 w-full items-center justify-center rounded-full border border-[#d9dfe8] px-6 text-[15px] font-semibold text-[#344054] transition hover:border-[#ff6a00] hover:text-[#ff6a00]">Retour au panier</Link>
        </section>
      </aside>
    </div>
  );
}
