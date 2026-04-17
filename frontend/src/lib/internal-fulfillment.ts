import "server-only";

import { getLomeChinaHubGuidance, type ShippingMethodKey, type SourcingOrder } from "@/lib/alibaba-sourcing";
import type { AlibabaReceptionAddress } from "@/lib/alibaba-operations";
import { getAlibabaReceptionAddresses } from "@/lib/alibaba-operations-store";

const OPERATOR_NAME = "Zacch Cargo";

function normalizeLabel(value: string | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function buildFallbackAddress(method: ShippingMethodKey): AlibabaReceptionAddress {
  const isSea = method === "sea";

  return {
    id: `internal-${method}`,
    label: isSea ? "Zacch Cargo Sea Hub" : "Zacch Cargo Air Hub",
    contactName: process.env.AFRIPAY_INTERNAL_CONTACT_NAME?.trim() || OPERATOR_NAME,
    phone: process.env.AFRIPAY_INTERNAL_CONTACT_PHONE?.trim() || "+33688639294",
    email: process.env.AFRIPAY_INTERNAL_CONTACT_EMAIL?.trim() || "jacenovel@gmail.com",
    addressLine1: isSea
      ? process.env.AFRIPAY_INTERNAL_SEA_ADDRESS_LINE1?.trim() || "Zacch Cargo Sea Consolidation Hub"
      : process.env.AFRIPAY_INTERNAL_AIR_ADDRESS_LINE1?.trim() || "Zacch Cargo Air Consolidation Hub",
    addressLine2: isSea
      ? process.env.AFRIPAY_INTERNAL_SEA_ADDRESS_LINE2?.trim() || "Warehouse reception"
      : process.env.AFRIPAY_INTERNAL_AIR_ADDRESS_LINE2?.trim() || "Express reception",
    city: isSea
      ? process.env.AFRIPAY_INTERNAL_SEA_CITY?.trim() || "Guangzhou"
      : process.env.AFRIPAY_INTERNAL_AIR_CITY?.trim() || "Guangzhou",
    state: isSea
      ? process.env.AFRIPAY_INTERNAL_SEA_STATE?.trim() || "Guangdong"
      : process.env.AFRIPAY_INTERNAL_AIR_STATE?.trim() || "Guangdong",
    postalCode: isSea
      ? process.env.AFRIPAY_INTERNAL_SEA_POSTAL_CODE?.trim() || "510000"
      : process.env.AFRIPAY_INTERNAL_AIR_POSTAL_CODE?.trim() || "510000",
    countryCode: "CN",
    port: isSea ? process.env.AFRIPAY_INTERNAL_SEA_PORT?.trim() || "Shenzhen" : undefined,
    portCode: isSea ? process.env.AFRIPAY_INTERNAL_SEA_PORT_CODE?.trim() || "CNSZX" : undefined,
    isDefault: true,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };
}

function buildLomeHubAddress(method: ShippingMethodKey): AlibabaReceptionAddress | null {
  const guidance = getLomeChinaHubGuidance("TG");
  if (!guidance) {
    return null;
  }

  const config = method === "sea" ? guidance.modes.sea : guidance.modes.air;

  return {
    id: `lome-hub-${method}`,
    label: method === "sea" ? "AfriPay China Sea Hub" : "AfriPay China Air Hub",
    contactName: config.contactName,
    phone: config.phone,
    email: process.env.AFRIPAY_INTERNAL_CONTACT_EMAIL?.trim() || "jacenovel@gmail.com",
    addressLine1: config.addressLine1,
    addressLine2: config.addressLine2,
    city: config.city,
    state: config.state,
    postalCode: config.postalCode,
    countryCode: config.countryCode,
    port: "port" in config ? config.port : undefined,
    portCode: "portCode" in config ? config.portCode : undefined,
    isDefault: true,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };
}

function selectInternalAddress(addresses: AlibabaReceptionAddress[], method: ShippingMethodKey) {
  const keywords = method === "sea" ? ["sea", "mer", "bateau", "ocean"] : ["air", "avion", "express"];
  const matching = addresses.find((address) => {
    const label = normalizeLabel(address.label);
    return address.countryCode === "CN" && keywords.some((keyword) => label.includes(keyword));
  });

  if (matching) {
    return matching;
  }

  return addresses.find((address) => address.countryCode === "CN" && address.isDefault) ?? addresses.find((address) => address.countryCode === "CN") ?? null;
}

export async function getInternalSupplierFulfillment(order: Pick<SourcingOrder, "shippingMethod" | "countryCode" | "customerName" | "customerPhone" | "customerEmail" | "addressLine1" | "addressLine2" | "city" | "state" | "postalCode" | "createdAt" | "updatedAt">) {
  const lomeHubGuidance = getLomeChinaHubGuidance(order.countryCode);
  const addresses = await getAlibabaReceptionAddresses();
  const selectedAddress = selectInternalAddress(addresses, order.shippingMethod)
    ?? (lomeHubGuidance ? buildLomeHubAddress(order.shippingMethod) : null)
    ?? buildFallbackAddress(order.shippingMethod);

  if (lomeHubGuidance) {
    const methodConfig = order.shippingMethod === "sea" ? lomeHubGuidance.modes.sea : lomeHubGuidance.modes.air;

    return {
      operatorName: lomeHubGuidance.operatorName,
      shippingMark: methodConfig.shippingMark,
      address: {
        ...selectedAddress,
        contactName: methodConfig.contactName,
        phone: methodConfig.phone,
        addressLine1: methodConfig.addressLine1,
        addressLine2: methodConfig.addressLine2,
        city: methodConfig.city,
        state: methodConfig.state,
        postalCode: methodConfig.postalCode,
        countryCode: methodConfig.countryCode,
        port: "port" in methodConfig ? methodConfig.port : undefined,
        portCode: "portCode" in methodConfig ? methodConfig.portCode : undefined,
      },
    };
  }

  return {
    operatorName: OPERATOR_NAME,
    shippingMark: `Client ${order.customerName} ${order.customerPhone}`,
    address: selectedAddress,
  };
}