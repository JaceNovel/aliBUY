"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { AlertTriangle, Check, ChevronDown, CircleHelp, LocateFixed, Minus, Plus, ShieldCheck, Ship, ShoppingCart, Truck, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useCart, useCartQuote } from "@/components/cart-provider";
import { buildLocalUrl, createOrder, initializeMonerooPayment, previewPromoCode } from "@/lib/api";
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

const EU_COUNTRY_CODES = [
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT",
  "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
] as const;

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

type CheckoutPaymentBadgeKey = "visa" | "mastercard" | "mobile-money" | "pay-later";

function CheckoutPaymentBadge({ brand }: { brand: CheckoutPaymentBadgeKey }) {
  if (brand === "visa") {
    return (
      <div className="flex h-10 min-w-[56px] items-center justify-center rounded-[12px] border border-[#dbe7ff] bg-white px-3 shadow-[0_6px_16px_rgba(17,24,39,0.04)]">
        <span className="text-[15px] font-black italic tracking-[-0.08em] text-[#1a4fd7]">VISA</span>
      </div>
    );
  }

  if (brand === "mastercard") {
    return (
      <div className="flex h-10 min-w-[56px] items-center justify-center gap-2 rounded-[12px] border border-[#ffe4dd] bg-white px-3 shadow-[0_6px_16px_rgba(17,24,39,0.04)]">
        <div className="relative h-5 w-8">
          <span className="absolute left-0 top-0 h-5 w-5 rounded-full bg-[#eb001b]" />
          <span className="absolute right-0 top-0 h-5 w-5 rounded-full bg-[#f79e1b]" />
        </div>
      </div>
    );
  }

  if (brand === "mobile-money") {
    return (
      <div className="flex h-10 min-w-[56px] items-center justify-center gap-2 rounded-[12px] border border-[#d6f5df] bg-white px-3 shadow-[0_6px_16px_rgba(17,24,39,0.04)]">
        <div className="relative h-6 w-4 rounded-[5px] border-2 border-[#16a34a]">
          <span className="absolute inset-x-1 bottom-1 h-0.5 rounded-full bg-[#16a34a]" />
        </div>
        <span className="text-[9px] font-extrabold uppercase tracking-[0.08em] text-[#15803d]">MM</span>
      </div>
    );
  }

  return (
    <div className="flex h-10 min-w-[56px] items-center justify-center gap-2 rounded-[12px] border border-[#dbe4ff] bg-white px-3 shadow-[0_6px_16px_rgba(17,24,39,0.04)]">
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#eef2ff] text-[10px] font-black text-[#4338ca]">24</div>
      <span className="text-[9px] font-extrabold uppercase tracking-[0.08em] text-[#4338ca]">LATER</span>
    </div>
  );
}

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
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<"card" | "mobile" | "pay_on_delivery">("card");
  const [payOnDeliveryIdentityFirstName, setPayOnDeliveryIdentityFirstName] = useState("");
  const [payOnDeliveryIdentityLastName, setPayOnDeliveryIdentityLastName] = useState("");
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
  const isEuropeanUnionDestination = EU_COUNTRY_CODES.includes(canonicalizeCountryCode(form.countryCode, "TG") as (typeof EU_COUNTRY_CODES)[number]);
  const paymentChoices = [
    {
      key: "card" as const,
      title: "Carte bancaire",
      subtitle: "Visa, Mastercard",
      badges: ["visa", "mastercard"] as CheckoutPaymentBadgeKey[],
    },
    {
      key: "mobile" as const,
      title: "Mobile Money",
      subtitle: "Via checkout Moneroo",
      badges: ["mobile-money"] as CheckoutPaymentBadgeKey[],
    },
    ...(!isEuropeanUnionDestination ? [{
      key: "pay_on_delivery" as const,
      title: "Paiement après livraison",
      subtitle: "Validation avec identité",
      badges: ["pay-later"] as CheckoutPaymentBadgeKey[],
    }] : []),
  ];

  useEffect(() => {
    if (savedAddressList.length === 0 || form.customerAddressId) {
      return;
    }

    const fallbackAddress = savedAddressList.find((address) => address.isDefault) ?? savedAddressList[0];
    if (!fallbackAddress) {
      return;
    }

    setForm((current) => ({
      ...current,
      ...buildFormFromAddress(fallbackAddress, initialUser),
      notes: current.notes,
    }));
    setIsAddressModalOpen(false);
    setAddressModalView("list");
  }, [form.customerAddressId, initialUser, savedAddressList]);

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

    if (selectedPaymentMethod === "pay_on_delivery") {
      if (isEuropeanUnionDestination) {
        setErrorMessage("Le paiement après livraison n'est pas disponible pour les pays de l'Union européenne.");
        return;
      }

      if (!payOnDeliveryIdentityFirstName.trim() || !payOnDeliveryIdentityLastName.trim()) {
        setErrorMessage("Le nom et le prénom figurant sur la pièce d'identité sont obligatoires pour ce mode de paiement.");
        return;
      }
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
        paymentMethod: selectedPaymentMethod,
        payOnDeliveryIdentityFirstName: selectedPaymentMethod === "pay_on_delivery" ? payOnDeliveryIdentityFirstName.trim() : undefined,
        payOnDeliveryIdentityLastName: selectedPaymentMethod === "pay_on_delivery" ? payOnDeliveryIdentityLastName.trim() : undefined,
        items,
        deliveryProfile: deliveryPlan.deliveryProfile,
        promoCode: appliedPromo?.code,
        sharedCartToken: sharedCartContext?.token,
      });

      if (selectedPaymentMethod === "pay_on_delivery") {
        setIsSubmitting(false);
        clearCart();
        clearSharedCartContext();
        router.push("/orders");
        return;
      }

      try {
        const paymentPayload = await initializeMonerooPayment(payload.order.id);
        const checkoutUrl = paymentPayload.checkoutUrl || paymentPayload.order?.monerooCheckoutUrl;

        clearCart();
        clearSharedCartContext();
        setIsSubmitting(false);

        if (checkoutUrl) {
          window.location.href = checkoutUrl;
          return;
        }

        router.push(`/orders/payment?orderId=${encodeURIComponent(payload.order.id)}`);
      } catch (paymentError) {
        clearCart();
        clearSharedCartContext();
        setIsSubmitting(false);
        setErrorMessage(paymentError instanceof Error
          ? `${paymentError.message} La commande a ete creee, mais le checkout Moneroo ne s'est pas ouvert automatiquement.`
          : "La commande a ete creee, mais le checkout Moneroo ne s'est pas ouvert automatiquement.");
        router.push(`/orders/payment?orderId=${encodeURIComponent(payload.order.id)}`);
      }
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
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_410px] xl:gap-6">
      <div className="space-y-3 sm:space-y-4">
        <section className="overflow-hidden rounded-[18px] bg-white px-4 py-3.5 shadow-[0_1px_0_rgba(0,0,0,0.06)] sm:px-7 sm:py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[15px] font-bold tracking-[-0.03em] text-[#111827] sm:text-[20px]">Adresse de livraison</div>
              <div className="mt-2.5 text-[14px] font-semibold text-[#111827] sm:mt-4 sm:text-[18px]">
                {form.customerName || initialUser.displayName || "Nom du destinataire"}
                {form.customerPhone ? <span className="ml-2 text-[12px] font-medium text-[#344054] sm:ml-4 sm:text-[18px]">{form.customerPhone}</span> : null}
              </div>
              <div className="mt-1 max-w-[780px] text-[12px] leading-5 text-[#475467] sm:text-[15px] sm:leading-7">{activeAddressSummary}</div>
              {deliveryPlan.deliveryProfile.unsupportedCountry ? (
                <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#fff4e8] px-3 py-1.5 text-[12px] font-semibold text-[#b45309] sm:px-4 sm:py-2 sm:text-[13px]">
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
              className="inline-flex shrink-0 items-center gap-2 text-[13px] font-semibold text-[#2563eb] transition hover:text-[#1d4ed8] sm:text-[16px]"
            >
              Changer
            </button>
          </div>

          {errorMessage ? <div className="mt-4 rounded-[18px] bg-[#fde8e8] px-4 py-4 text-[13px] font-semibold text-[#b42318]">{errorMessage}</div> : null}
          {locationFeedback ? <div className="mt-4 rounded-[18px] bg-[#eef6ff] px-4 py-4 text-[13px] font-semibold text-[#1d4f91]">{locationFeedback}</div> : null}
        </section>

        <section className="overflow-hidden rounded-[18px] bg-white px-4 py-3.5 shadow-[0_1px_0_rgba(0,0,0,0.06)] sm:px-7 sm:py-5">
          <div className="flex items-center justify-between gap-4">
            <div className="text-[15px] font-bold tracking-[-0.03em] text-[#111827] sm:text-[20px]">Moyens de paiement</div>
          </div>

          <div className="mt-2.5 divide-y divide-[#eef2f6] sm:mt-4">
            {paymentChoices.map((method) => (
              <button
                key={method.key}
                type="button"
                onClick={() => setSelectedPaymentMethod(method.key)}
                className="flex w-full items-start gap-3 py-3 text-left sm:gap-4 sm:py-5"
              >
                <div className={["mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border sm:mt-1 sm:h-7 sm:w-7", selectedPaymentMethod === method.key ? "border-[#2563eb] bg-white text-[#2563eb]" : "border-[#d0d5dd] bg-white text-transparent"].join(" ")}>
                  <Check className="h-4 w-4" />
                </div>
                <div className="mt-0.5 flex shrink-0 items-center gap-1.5">
                  {method.badges.map((badge) => (
                    <CheckoutPaymentBadge key={`${method.key}-${badge}`} brand={badge} />
                  ))}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-semibold leading-5 text-[#111827] sm:text-[18px]">{method.title}</div>
                  <div className="mt-0.5 text-[11px] leading-5 text-[#667085] sm:text-[13px]">{method.subtitle}</div>
                </div>
              </button>
            ))}
          </div>

          {selectedPaymentMethod === "pay_on_delivery" ? (
            <div className="mt-4 rounded-[18px] border border-[#dbe4ff] bg-[#f7f9ff] p-3.5 sm:p-4">
              <div className="text-[14px] font-semibold text-[#111827] sm:text-[15px]">Identité du client</div>
              <div className="mt-1 text-[12px] leading-5 text-[#667085] sm:text-[13px] sm:leading-6">
                Entrez le nom et le prénom qui figurent sur la carte d&apos;identité. La commande sera créée sans paiement immédiat.
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-[13px] font-semibold text-[#344054]">
                  Nom
                  <input value={payOnDeliveryIdentityLastName} onChange={(event) => setPayOnDeliveryIdentityLastName(event.target.value)} placeholder="Nom sur la pièce d'identité" className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] bg-white px-4 text-[14px] text-[#111827] outline-none focus:border-[#111827]" />
                </label>
                <label className="text-[13px] font-semibold text-[#344054]">
                  Prénom
                  <input value={payOnDeliveryIdentityFirstName} onChange={(event) => setPayOnDeliveryIdentityFirstName(event.target.value)} placeholder="Prénom sur la pièce d'identité" className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] bg-white px-4 text-[14px] text-[#111827] outline-none focus:border-[#111827]" />
                </label>
              </div>
            </div>
          ) : null}
        </section>

        <section className="overflow-hidden rounded-[18px] bg-white px-4 py-4 shadow-[0_1px_0_rgba(0,0,0,0.06)] sm:px-7 sm:py-5">
          <div className="flex items-center justify-between gap-4">
            <div className="text-[17px] font-bold tracking-[-0.03em] text-[#111827] sm:text-[20px]">
              {isDirectAliExpressFlow ? "Expédié directement" : "Expédié par AfriPay"}
            </div>
            <div className="text-[13px] font-semibold text-[#2563eb] sm:text-[16px]">{quote.items.length > 0 ? `Voir(${quote.items.length})` : null}</div>
          </div>

          <div className="mt-3 space-y-2.5 sm:mt-4 sm:space-y-3">
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
                    "flex w-full items-start gap-3 rounded-[16px] border px-3.5 py-3.5 text-left transition sm:rounded-[18px] sm:px-4 sm:py-4",
                    selectedShipping === option.key ? "border-[#111827] bg-[#fafafa]" : "border-[#e5e7eb] bg-white hover:border-[#cbd5e1]",
                  ].join(" ")}
                >
                  <div className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-[#f3f4f6] text-[#111827] sm:h-10 sm:w-10">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[14px] font-semibold text-[#111827] sm:text-[16px]">{option.label}</div>
                      <div className="text-[14px] font-bold text-[#111827] sm:text-[16px]">{option.isFree ? "gratuit" : formatSourcingAmount(option.priceFcfa, { currencyCode, locale })}</div>
                    </div>
                    <div className="mt-1 text-[12px] leading-5 text-[#667085] sm:text-[13px]">{formatShippingTradeLabel(option, { currencyCode, locale })}</div>
                    <div className="mt-1 text-[12px] text-[#667085] sm:text-[13px]">Livraison : {option.deliveryWindow}</div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-4 space-y-3 border-t border-[#eef2f6] pt-4 sm:mt-5 sm:space-y-4 sm:pt-5">
            {quote.items.map((item) => {
              const quantity = items.find((entry) => entry.slug === item.slug && JSON.stringify(entry.selectedVariants ?? {}) === JSON.stringify(item.selectedVariants ?? {}))?.quantity ?? item.quantity;

              return (
                <article key={item.cartKey ?? `${item.slug}-${item.selectionLabel ?? item.title}`} className="flex gap-3 sm:gap-4">
                  <div className="relative h-[84px] w-[84px] shrink-0 overflow-hidden rounded-[8px] bg-[#f8fafc] ring-1 ring-[#eceff3] sm:h-[112px] sm:w-[112px]">
                    <Image src={item.image} alt={item.title} fill sizes="(max-width: 640px) 84px, 112px" className="object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-2 text-[15px] font-semibold leading-5 tracking-[-0.03em] text-[#111827] sm:text-[18px] sm:leading-6">{item.title}</div>
                    {item.selectionLabel ? <div className="mt-1 line-clamp-1 text-[12px] text-[#667085] sm:text-[13px]">{item.selectionLabel}</div> : null}
                    <div className="mt-1.5 text-[13px] font-semibold text-[#111827] sm:mt-2 sm:text-[14px]">{formatSourcingAmount(item.finalUnitPriceFcfa, { currencyCode, locale })}</div>
                    <div className="mt-2 flex items-center gap-2.5 sm:mt-3 sm:gap-3">
                      <button type="button" onClick={() => updateItem(item.cartKey ?? item.slug, quantity - 1)} className="inline-flex h-7 w-7 items-center justify-center border border-[#d0d5dd] bg-white text-[#111827] transition hover:border-[#111827] sm:h-8 sm:w-8">
                        <Minus className="h-4 w-4" />
                      </button>
                      <div className="min-w-[20px] text-center text-[16px] font-medium text-[#111827] sm:min-w-[24px] sm:text-[18px]">{quantity}</div>
                      <button type="button" onClick={() => updateItem(item.cartKey ?? item.slug, quantity + 1)} className="inline-flex h-7 w-7 items-center justify-center border border-[#d0d5dd] bg-white text-[#111827] transition hover:border-[#111827] sm:h-8 sm:w-8">
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-2 text-[12px] font-semibold text-[#111827] sm:mt-3 sm:text-[15px]">
                      Frais de livraison : {selectedOption?.isFree ? "Livraison gratuite" : selectedShippingLabel}
                    </div>
                    <div className="mt-1 text-[11px] text-[#667085] sm:text-[13px]">Livraison : {selectedOption?.deliveryWindow ?? "A confirmer"}</div>
                    <div className="mt-1 text-[11px] text-[#667085] sm:text-[13px]">Courrier company: Colissimo, Mondial Relay, Colis Privé, etc.</div>
                    <div className="mt-1 text-[11px] font-medium text-[#475467] sm:text-[13px]">Poids : {item.weightKg.toFixed(2)} kg · Volume : {item.volumeCbm.toFixed(4)} CBM</div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>

      <aside className="space-y-3 xl:sticky xl:top-6 xl:self-start xl:space-y-4">
        <section className="overflow-hidden rounded-[18px] bg-white px-4 py-4 shadow-[0_1px_0_rgba(0,0,0,0.06)] sm:px-7 sm:py-6">
          <div className="text-[16px] font-bold tracking-[-0.03em] text-[#111827] sm:text-[20px]">Résumé</div>
          <div className="mt-3.5 space-y-3 text-[12px] text-[#111827] sm:mt-6 sm:space-y-5 sm:text-[15px]">
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold">Sous-total</span>
              <span className="text-[14px] font-bold sm:text-[16px]">{formatSourcingAmount(quote.cartProductsTotalFcfa, { currencyCode, locale })}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold">Code promo</span>
              <button type="button" onClick={() => setIsPromoOpen((current) => !current)} className="inline-flex items-center gap-2 text-[12px] font-medium text-[#111827] sm:text-[15px]">
                {appliedPromo ? appliedPromo.code : "Entrer le code ici"}
                <ChevronDown className={["h-4 w-4 transition", isPromoOpen ? "rotate-180" : ""].join(" ")} />
              </button>
            </div>
            {isPromoOpen ? (
              <div className="rounded-[16px] bg-[#f8fafc] p-3 sm:p-4">
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
              <span className="inline-flex items-center gap-2 text-[14px] font-bold sm:text-[16px]">
                {selectedOption?.isFree ? "gratuit" : selectedShippingLabel}
                <ChevronDown className="h-4 w-4" />
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold">Poids total</span>
              <span className="text-[14px] font-bold sm:text-[16px]">{quote.totalWeightKg.toFixed(2)} kg</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold">Volume total</span>
              <span className="text-[14px] font-bold sm:text-[16px]">{quote.totalCbm.toFixed(4)} CBM</span>
            </div>
          </div>

          <div className="mt-4 border-t border-[#eaecf0] pt-4 sm:mt-6 sm:pt-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="text-[15px] font-bold tracking-[-0.03em] text-[#111827] sm:text-[18px]">Total</div>
                <div className="mt-1 inline-flex items-center gap-1 text-[12px] text-[#667085] sm:text-[14px]">
                  TVA incluse
                  <CircleHelp className="h-4 w-4" />
                </div>
              </div>
              <div className="text-[18px] font-black tracking-[-0.05em] text-[#111827] sm:text-[22px]">{formatSourcingAmount(totalPrice, { currencyCode, locale })}</div>
            </div>
          </div>

          <button type="button" onClick={submitOrder} disabled={isSubmitting || isLoading || !selectedOption} className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-full bg-[#f00633] px-4 text-[14px] font-bold text-white transition hover:bg-[#d9042d] disabled:cursor-not-allowed disabled:opacity-70 sm:mt-6 sm:h-14 sm:px-6 sm:text-[16px]">
            {isSubmitting ? "Création en cours..." : selectedPaymentMethod === "pay_on_delivery" ? "Commander sans payer" : "Commander"}
          </button>

          <p className="mt-3 text-[11px] leading-5 text-[#98a2b3] sm:mt-5 sm:text-[13px] sm:leading-7">
            En cliquant sur « Passer une commande », je confirme avoir lu et pris connaissance de toutes les{" "}
            <Link href="/protection-commandes" className="font-semibold text-[#2563eb] underline-offset-2 transition hover:underline">
              conditions et politiques
            </Link>, ainsi que les{" "}
            <Link href="/protection-commandes#paiements-securises" className="font-semibold text-[#2563eb] underline-offset-2 transition hover:underline">
              informations pour les consommateurs européens
            </Link>.
          </p>
        </section>

        <section className="overflow-hidden rounded-[18px] bg-white px-4 py-4 shadow-[0_1px_0_rgba(0,0,0,0.06)] sm:px-7 sm:py-6">
          <div className="flex items-start gap-3">
            <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-[#f3f4f6] text-[#111827] sm:h-11 sm:w-11">
              <ShieldCheck className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div>
              <div className="text-[15px] font-bold tracking-[-0.03em] text-[#111827] sm:text-[18px]">AfriPay</div>
              <div className="mt-2 text-[12px] leading-5 text-[#667085] sm:text-[15px] sm:leading-7">
                AfriPay protège vos informations personnelles et de paiement
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.1em] text-[#98a2b3] sm:mt-4 sm:gap-3 sm:text-[11px] sm:tracking-[0.14em]">
                <span className="rounded-full bg-[#f8fafc] px-2.5 py-1.5 sm:px-3">SSL</span>
                <span className="rounded-full bg-[#f8fafc] px-2.5 py-1.5 sm:px-3">Paiement sécurisé</span>
                <span className="rounded-full bg-[#f8fafc] px-2.5 py-1.5 sm:px-3">Contrôle qualité</span>
              </div>
            </div>
          </div>
        </section>
      </aside>

      {isAddressModalOpen ? (
        <div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/55 px-3 py-4 sm:px-6 sm:py-8">
          <div className="relative max-h-[calc(100vh-2rem)] w-full max-w-[1060px] overflow-y-auto rounded-[18px] bg-white shadow-[0_32px_80px_rgba(0,0,0,0.28)] sm:max-h-[calc(100vh-4rem)] sm:rounded-[22px]">
            <button
              type="button"
              onClick={closeAddressModal}
              className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full text-[#98a2b3] transition hover:bg-[#f4f4f5] hover:text-[#111827] sm:right-5 sm:top-5 sm:h-10 sm:w-10"
            >
              <X className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>

            {addressModalView === "list" ? (
              <div className="flex min-h-[560px] flex-col px-4 pb-5 pt-3 sm:min-h-[620px] sm:px-8 sm:pb-6 sm:pt-4">
                <div className="border-b border-[#f0f2f5] pb-4 text-center text-[16px] font-bold text-[#111827] sm:pb-5 sm:text-[18px]">Adresse de livraison</div>
                <div className="mt-4 flex-1 space-y-3 sm:mt-6 sm:space-y-4">
                  {savedAddressList.length > 0 ? (
                    savedAddressList.map((address) => {
                      const isActive = form.customerAddressId === address.id;

                      return (
                        <div key={address.id} className="rounded-[14px] border border-[#d7dde5] px-3 py-4 sm:rounded-[16px] sm:px-6 sm:py-5">
                          <div className="flex items-start gap-3 sm:gap-4">
                            <button
                              type="button"
                              onClick={() => applySavedAddress(address)}
                              className="mt-3 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-[#ff5533] text-[#ff5533] sm:mt-5 sm:h-7 sm:w-7"
                            >
                              {isActive ? <div className="h-3.5 w-3.5 rounded-full bg-[#ff5533]" /> : null}
                            </button>
                            <button type="button" onClick={() => applySavedAddress(address)} className="min-w-0 flex-1 text-left">
                              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                                <span className="text-[14px] font-bold text-[#111827] sm:text-[16px]">{address.recipientName}</span>
                                <span className="text-[13px] text-[#98a2b3] sm:text-[16px]">{address.phone}</span>
                              </div>
                              <div className="mt-1 text-[13px] leading-6 text-[#475467] sm:text-[16px] sm:leading-8">{formatSavedAddress(address)}</div>
                              {address.isDefault ? <div className="mt-3 inline-flex rounded-[8px] bg-[#fff1f0] px-3 py-1 text-[11px] font-medium text-[#ff5533] sm:mt-4 sm:px-4 sm:text-[12px]">Par défaut</div> : null}
                            </button>
                            <button type="button" onClick={() => startEditAddress(address)} className="text-[13px] font-medium text-[#2563eb] transition hover:text-[#1d4ed8] sm:text-[16px]">
                              Modifier
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-[14px] border border-dashed border-[#d7dde5] px-4 py-10 text-center text-[14px] text-[#667085] sm:rounded-[16px] sm:px-6 sm:py-14 sm:text-[15px]">
                      Aucune adresse enregistrée pour le moment.
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={startNewAddress}
                  className="mx-auto mt-5 inline-flex h-11 w-full max-w-[460px] items-center justify-center rounded-full bg-[#ff334d] px-5 text-[15px] font-bold text-white transition hover:bg-[#f00633] sm:mt-6 sm:h-13 sm:px-6 sm:text-[17px]"
                >
                  Ajouter une nouvelle adresse
                </button>
              </div>
            ) : (
              <div className="px-4 pb-6 pt-3 sm:px-9 sm:pb-8 sm:pt-4">
                <div className="border-b border-[#f0f2f5] pb-4 text-center text-[16px] font-bold text-[#111827] sm:pb-5 sm:text-[18px]">
                  {editingAddressId ? "Modifier l'adresse" : "Ajouter une nouvelle adresse"}
                </div>

                <div className="mt-5 sm:mt-7">
                  <div className="text-[15px] font-bold text-[#111827] sm:text-[16px]">Informations personnelles</div>
                  <div className="mt-3 grid gap-3 sm:mt-4 sm:gap-4 lg:grid-cols-[1fr_1fr_1.1fr]">
                    <label className="text-[12px] font-semibold text-[#344054] sm:text-[13px]">
                      Nom complet
                      <input value={form.customerName} onChange={(event) => updateFormField("customerName", event.target.value)} placeholder="Nom complet*" className="mt-2 h-11 w-full rounded-[10px] border border-[#d7dce5] px-3.5 text-[15px] text-[#111827] outline-none focus:border-[#111827] sm:h-13 sm:px-4 sm:text-[16px]" />
                    </label>
                    <label className="text-[12px] font-semibold text-[#344054] sm:text-[13px]">
                      Email
                      <input value={form.customerEmail} onChange={(event) => updateFormField("customerEmail", event.target.value)} type="email" autoComplete="email" placeholder="Email*" className="mt-2 h-11 w-full rounded-[10px] border border-[#d7dce5] px-3.5 text-[15px] text-[#111827] outline-none focus:border-[#111827] sm:h-13 sm:px-4 sm:text-[16px]" />
                    </label>
                    <label className="text-[12px] font-semibold text-[#344054] sm:text-[13px]">
                      Téléphone
                      <input value={form.customerPhone} onChange={(event) => updateFormField("customerPhone", event.target.value)} autoComplete="tel" placeholder="Numéro de téléphone*" className="mt-2 h-11 w-full rounded-[10px] border border-[#d7dce5] px-3.5 text-[15px] text-[#111827] outline-none focus:border-[#111827] sm:h-13 sm:px-4 sm:text-[16px]" />
                    </label>
                  </div>
                </div>

                <div className="mt-5 sm:mt-7">
                  <div className="text-[15px] font-bold text-[#111827] sm:text-[16px]">
                    {requiresTransitAddress ? "Adresse actuelle" : "Adresse"}
                  </div>

                  {requiresTransitAddress ? (
                    <div className="mt-3 space-y-3 sm:mt-4 sm:space-y-4">
                      <div className="grid gap-3 sm:gap-4 lg:grid-cols-[1.35fr_0.65fr]">
                        <label className="text-[12px] font-semibold text-[#344054] sm:text-[13px]">
                          Ma position actuelle Google Maps
                          <input value={form.googleMapsUrl} onChange={(event) => updateFormField("googleMapsUrl", event.target.value)} placeholder="https://www.google.com/maps?q=..." className="mt-2 h-11 w-full rounded-[10px] border border-[#d7dce5] px-3.5 text-[14px] text-[#111827] outline-none focus:border-[#111827] sm:h-13 sm:px-4 sm:text-[15px]" />
                        </label>
                        <div className="grid gap-2 pt-0 lg:pt-7">
                          <button type="button" onClick={resolveMapsLink} disabled={isResolvingMapsLink || !form.googleMapsUrl.trim()} className="inline-flex h-11 items-center justify-center rounded-[10px] border border-[#d7dce5] px-4 text-[13px] font-semibold text-[#111827] transition hover:border-[#111827] disabled:cursor-not-allowed disabled:opacity-60 sm:h-13 sm:text-[14px]">{isResolvingMapsLink ? "Lecture du lien..." : "Lire le lien"}</button>
                          <button type="button" onClick={useCurrentPosition} disabled={isLocating} className="inline-flex h-11 items-center justify-center gap-2 rounded-[10px] bg-[#111827] px-4 text-[13px] font-semibold text-white transition hover:bg-[#1f2937] disabled:cursor-not-allowed disabled:opacity-70 sm:h-13 sm:text-[14px]"><LocateFixed className="h-4 w-4" />{isLocating ? "Localisation..." : "Utiliser ma position"}</button>
                        </div>
                      </div>
                      <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">
                        <label className="text-[12px] font-semibold text-[#344054] sm:text-[13px]">
                          Pays détecté
                          <input value={getCountryDisplayLabel(form.countryCode)} readOnly className="mt-2 h-11 w-full rounded-[10px] border border-[#e4e7ec] bg-[#f8fafc] px-3.5 text-[14px] text-[#667085] outline-none sm:h-13 sm:px-4 sm:text-[15px]" />
                        </label>
                        <label className="text-[12px] font-semibold text-[#344054] sm:text-[13px]">
                          Ville détectée
                          <input value={form.city} readOnly className="mt-2 h-11 w-full rounded-[10px] border border-[#e4e7ec] bg-[#f8fafc] px-3.5 text-[14px] text-[#667085] outline-none sm:h-13 sm:px-4 sm:text-[15px]" />
                        </label>
                        <label className="lg:col-span-2 text-[12px] font-semibold text-[#344054] sm:text-[13px]">
                          Adresse détectée
                          <input value={quickAddress} readOnly className="mt-2 h-11 w-full rounded-[10px] border border-[#e4e7ec] bg-[#f8fafc] px-3.5 text-[14px] text-[#667085] outline-none sm:h-13 sm:px-4 sm:text-[15px]" />
                        </label>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 space-y-3 sm:mt-4 sm:space-y-4">
                      <div className="grid gap-3 sm:gap-4 lg:grid-cols-[1.25fr_0.75fr_0.9fr_1fr]">
                        <label className="text-[12px] font-semibold text-[#344054] sm:text-[13px]">
                          Pays
                          <select value={isSupportedDirectDeliveryCountry(form.countryCode) || usesInternalReceptionAddress ? form.countryCode : DELIVERY_COUNTRY_OPTIONS[0]?.code} onChange={(event) => selectSupportedCountry(event.target.value)} className="mt-2 h-11 w-full rounded-[10px] border border-[#d7dce5] bg-white px-3.5 text-[15px] text-[#111827] outline-none focus:border-[#111827] sm:h-13 sm:px-4 sm:text-[16px]">
                            {DELIVERY_COUNTRY_OPTIONS.map((country) => (
                              <option key={country.code} value={country.code}>{country.flagEmoji} {country.label}</option>
                            ))}
                          </select>
                        </label>
                        <label className="text-[12px] font-semibold text-[#344054] sm:text-[13px]">
                          Code postal
                          <input value={form.postalCode} onChange={(event) => updateFormField("postalCode", event.target.value)} placeholder="Code postal*" className="mt-2 h-11 w-full rounded-[10px] border border-[#d7dce5] px-3.5 text-[15px] text-[#111827] outline-none focus:border-[#111827] sm:h-13 sm:px-4 sm:text-[16px]" />
                        </label>
                        <label className="text-[12px] font-semibold text-[#344054] sm:text-[13px]">
                          Région / État
                          <input value={form.state} onChange={(event) => updateFormField("state", event.target.value)} placeholder="Région*" className="mt-2 h-11 w-full rounded-[10px] border border-[#d7dce5] px-3.5 text-[15px] text-[#111827] outline-none focus:border-[#111827] sm:h-13 sm:px-4 sm:text-[16px]" />
                        </label>
                        <label className="text-[12px] font-semibold text-[#344054] sm:text-[13px]">
                          Ville
                          <input value={form.city} onChange={(event) => updateFormField("city", event.target.value)} placeholder="Ville*" className="mt-2 h-11 w-full rounded-[10px] border border-[#d7dce5] px-3.5 text-[15px] text-[#111827] outline-none focus:border-[#111827] sm:h-13 sm:px-4 sm:text-[16px]" />
                        </label>
                      </div>
                      <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">
                        <label className="text-[12px] font-semibold text-[#344054] sm:text-[13px]">
                          Numéro et nom de la rue
                          <input value={form.addressLine1} onChange={(event) => updateFormField("addressLine1", event.target.value)} placeholder="Numéro et nom de la rue" className="mt-2 h-11 w-full rounded-[10px] border border-[#d7dce5] px-3.5 text-[15px] text-[#111827] outline-none focus:border-[#111827] sm:h-13 sm:px-4 sm:text-[16px]" />
                        </label>
                        <label className="text-[12px] font-semibold text-[#344054] sm:text-[13px]">
                          Appartement, suite, unité, etc. (facultatif)
                          <input value={form.addressLine2} onChange={(event) => updateFormField("addressLine2", event.target.value)} placeholder="Appartement, suite, unité, etc. (facultatif)" className="mt-2 h-11 w-full rounded-[10px] border border-[#d7dce5] px-3.5 text-[15px] text-[#111827] outline-none focus:border-[#111827] sm:h-13 sm:px-4 sm:text-[16px]" />
                        </label>
                      </div>
                    </div>
                  )}

                  <label className="mt-5 inline-flex items-center gap-3 text-[13px] text-[#111827] sm:mt-6 sm:text-[15px]">
                    <input type="checkbox" checked={isAddressDefaultDraft} onChange={(event) => setIsAddressDefaultDraft(event.target.checked)} className="h-5 w-5 rounded-[6px] border border-[#cbd5e1] sm:h-6 sm:w-6" />
                    Définir en tant qu&apos;adresse de livraison par défaut
                  </label>

                  {errorMessage ? <div className="mt-4 rounded-[14px] bg-[#fde8e8] px-4 py-3 text-[13px] font-semibold text-[#b42318]">{errorMessage}</div> : null}
                  {locationFeedback ? <div className="mt-4 rounded-[14px] bg-[#eef6ff] px-4 py-3 text-[13px] font-semibold text-[#1d4f91]">{locationFeedback}</div> : null}

                  <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
                    <button type="button" onClick={saveAddressFromModal} disabled={isSavingAddress} className="inline-flex h-11 w-full items-center justify-center rounded-full bg-[#ff334d] px-6 text-[15px] font-bold text-white transition hover:bg-[#f00633] disabled:cursor-not-allowed disabled:opacity-70 sm:h-13 sm:min-w-[220px] sm:w-auto sm:px-8 sm:text-[18px]">
                      {isSavingAddress ? "Enregistrement..." : "Confirmer"}
                    </button>
                    <button type="button" onClick={() => setAddressModalView("list")} className="inline-flex h-11 w-full items-center justify-center rounded-full border border-[#cbd5e1] bg-white px-6 text-[15px] font-semibold text-[#111827] transition hover:border-[#111827] sm:h-13 sm:min-w-[220px] sm:w-auto sm:px-8 sm:text-[18px]">
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
