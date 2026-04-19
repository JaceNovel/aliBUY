import {
  formatFcfa,
  isSourcingOrderClientPaid,
  resolveSourcingDeliveryPlan,
  type SourcingCheckoutInput,
  type SourcingOrder,
  type SourcingSeaContainer,
  type SourcingSettings,
  withSourcingOrderMeta,
} from "@/lib/alibaba-sourcing";
import { createAlibabaSourcingQuote, getAlibabaSourcingCatalogPreview } from "@/lib/alibaba-sourcing-server";
import { getSharedCartByToken, markSharedCartOrdered } from "@/lib/cart-share-store";
import { consumePromoCode, validatePromoCodeForAmount } from "@/lib/promo-codes-store";
import { createAlibabaIntegrationLog, createSourcingIds, getSourcingOrders, getSourcingSeaContainers, getSourcingSettings, saveSourcingOrder, saveSourcingSeaContainer, saveSourcingSettings } from "@/lib/sourcing-store";

function nowIso() {
  return new Date().toISOString();
}

function normalizePersistedUserId(userId?: string) {
  if (!userId || userId.startsWith("admin:")) {
    return undefined;
  }

  return userId;
}

function createOrderNumber(existingCount: number) {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `SRC-${stamp}-${String(existingCount + 1).padStart(4, "0")}`;
}

function createSeaContainerCode(existingCount: number) {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `SEA-${stamp}-${String(existingCount + 1).padStart(3, "0")}`;
}

function isMeaningfulCartSlug(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return Boolean(normalized) && normalized !== "undefined" && normalized !== "null";
}

export async function getSourcingDashboardData() {
  const [settings, orders, containers] = await Promise.all([
    getSourcingSettings(),
    getSourcingOrders(),
    getSourcingSeaContainers(),
  ]);

  return {
    settings,
    orders,
    containers,
    catalog: await getAlibabaSourcingCatalogPreview(settings, 8),
  };
}

export async function updateSourcingSettings(input: Partial<SourcingSettings>) {
  const current = await getSourcingSettings();
  const nextSettings: SourcingSettings = {
    ...current,
    ...input,
    updatedAt: nowIso(),
  };

  return saveSourcingSettings(nextSettings);
}

async function assignOrderToSeaContainer(order: SourcingOrder, settings: SourcingSettings) {
  const containers: SourcingSeaContainer[] = await getSourcingSeaContainers();
  const activeContainer = containers.find((container: SourcingSeaContainer) => container.status === "pending" || container.status === "ready_to_ship");
  const timestamp = nowIso();
  const nextCurrentCbm = Number(((activeContainer?.currentCbm ?? 0) + order.totalVolumeCbm).toFixed(4));
  const nextFillPercent = Math.min(100, Math.round((nextCurrentCbm / settings.containerTargetCbm) * 100));

  const container: SourcingSeaContainer = activeContainer
    ? {
        ...activeContainer,
        currentCbm: nextCurrentCbm,
        fillPercent: nextFillPercent,
        status: nextCurrentCbm >= settings.containerTargetCbm ? "ready_to_ship" : activeContainer.status,
        orderIds: [...new Set([...activeContainer.orderIds, order.id])],
        orderCount: new Set([...activeContainer.orderIds, order.id]).size,
        updatedAt: timestamp,
        readyToShipAt: nextCurrentCbm >= settings.containerTargetCbm ? timestamp : activeContainer.readyToShipAt,
      }
    : {
        id: createSourcingIds(),
        code: createSeaContainerCode(containers.length),
        targetCbm: settings.containerTargetCbm,
        currentCbm: order.totalVolumeCbm,
        fillPercent: Math.min(100, Math.round((order.totalVolumeCbm / settings.containerTargetCbm) * 100)),
        status: order.totalVolumeCbm >= settings.containerTargetCbm ? "ready_to_ship" : "pending",
        orderIds: [order.id],
        orderCount: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
        readyToShipAt: order.totalVolumeCbm >= settings.containerTargetCbm ? timestamp : undefined,
      };

  await saveSourcingSeaContainer(container);
  return container;
}

export async function createCheckoutOrder(input: SourcingCheckoutInput) {
  const sanitizedItems = input.items.filter((item: SourcingCheckoutInput["items"][number]) => isMeaningfulCartSlug(item.slug) && item.quantity > 0);
  if (sanitizedItems.length === 0) {
    throw new Error("Aucun article sourcing valide n'a ete transmis pour cette commande.");
  }

  const persistedUserId = normalizePersistedUserId(input.userId);
  const settings = await getSourcingSettings();
  const deliveryPlan = resolveSourcingDeliveryPlan({
    countryCode: input.countryCode,
    city: input.city,
    deliveryProfile: input.deliveryProfile,
  });

  const quote = await createAlibabaSourcingQuote(sanitizedItems, settings, {
    disableFreeAir: !deliveryPlan.workflow.freeDeliveryEligible,
    countryCode: input.countryCode,
  });
  if (quote.items.length === 0) {
    throw new Error("Les articles selectionnes ne correspondent plus a des produits fournisseur publiés. Rechargez le panier puis reessayez.");
  }
  const shippingOption = quote.shippingOptions.find((option) => option.key === input.shippingMethod);

  if (!shippingOption || shippingOption.isAvailable === false) {
    throw new Error(shippingOption?.availabilityNote || "La methode de livraison selectionnee n'est pas disponible pour ce panier.");
  }

  const existingOrders = await getSourcingOrders();
  const timestamp = nowIso();
  const baseTotalPriceFcfa = quote.cartProductsTotalFcfa + shippingOption.priceFcfa;
  const sharedCart = input.sharedCartToken ? await getSharedCartByToken(input.sharedCartToken) : null;

  if (input.sharedCartToken && !sharedCart) {
    throw new Error("Le lien de panier partagé est introuvable ou expiré.");
  }

  const promoAdjustment = input.promoCode
    ? await validatePromoCodeForAmount({ code: input.promoCode, totalFcfa: baseTotalPriceFcfa })
    : null;
  const finalTotalPriceFcfa = promoAdjustment?.finalTotalFcfa ?? baseTotalPriceFcfa;
  const paymentMethod = input.paymentMethod === "mobile" || input.paymentMethod === "pay_on_delivery"
    ? input.paymentMethod
    : "card";

  let order: SourcingOrder = {
    id: createSourcingIds(),
    orderNumber: createOrderNumber(existingOrders.length),
    userId: persistedUserId,
    customerAddressId: persistedUserId ? input.customerAddressId : undefined,
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    customerPhone: input.customerPhone,
    googleMapsUrl: input.googleMapsUrl,
    addressLine1: input.addressLine1,
    addressLine2: input.addressLine2,
    city: input.city,
    state: input.state,
    postalCode: input.postalCode,
    countryCode: input.countryCode,
    shippingMethod: input.shippingMethod,
    shippingCostFcfa: shippingOption.priceFcfa,
    cartProductsTotalFcfa: quote.cartProductsTotalFcfa,
    totalPriceFcfa: finalTotalPriceFcfa,
    totalWeightKg: quote.totalWeightKg,
    totalVolumeCbm: quote.totalCbm,
    status: "checkout_created",
    freightStatus: "not_requested",
    supplierOrderStatus: "not_created",
    paymentStatus: "unpaid",
    paymentProvider: paymentMethod === "pay_on_delivery" ? undefined : "moneroo",
    paymentCurrency: "XOF",
    alibabaTradeIds: [],
    notes: input.notes,
    createdAt: timestamp,
    updatedAt: timestamp,
    items: quote.items,
  };
  order = withSourcingOrderMeta(order, {
    deliveryProfile: deliveryPlan.deliveryProfile,
    workflow: deliveryPlan.workflow,
    promo: promoAdjustment
      ? {
          code: promoAdjustment.promoCode.code,
          label: promoAdjustment.promoCode.label,
          discountFcfa: promoAdjustment.discountFcfa,
          baseTotalFcfa: baseTotalPriceFcfa,
          finalTotalFcfa: promoAdjustment.finalTotalFcfa,
          appliedAt: timestamp,
        }
      : undefined,
    sharedCart: sharedCart
      ? {
          token: sharedCart.token,
          ownerUserId: sharedCart.ownerUserId,
          ownerEmail: sharedCart.ownerEmail,
          ownerDisplayName: sharedCart.ownerDisplayName,
          message: sharedCart.message,
          importedAt: timestamp,
        }
      : undefined,
    paymentContext: {
      payerUserId: persistedUserId,
      payerDisplayName: input.payerDisplayName || input.customerName,
      payerEmail: input.payerEmail || input.customerEmail,
      paymentMethod,
      payOnDeliveryIdentityFirstName: paymentMethod === "pay_on_delivery" ? input.payOnDeliveryIdentityFirstName?.trim() : undefined,
      payOnDeliveryIdentityLastName: paymentMethod === "pay_on_delivery" ? input.payOnDeliveryIdentityLastName?.trim() : undefined,
      createdFromSharedCart: Boolean(sharedCart),
      thirdPartyCreatorName: sharedCart?.ownerDisplayName,
      thirdPartyCreatorEmail: sharedCart?.ownerEmail,
    },
    manychat: input.manychatSubscriberId
      ? {
          subscriberId: input.manychatSubscriberId,
          flowId: input.manychatFlowId,
          paidTagId: input.manychatPaidTagId,
        }
      : undefined,
  });

  await saveSourcingOrder(order);

  if (promoAdjustment) {
    await consumePromoCode({ code: promoAdjustment.promoCode.code, orderId: order.id });
  }

  if (sharedCart) {
    await markSharedCartOrdered({
      token: sharedCart.token,
      claimerUserId: persistedUserId ?? "guest",
      claimerDisplayName: input.payerDisplayName || input.customerName,
      orderId: order.id,
    });
  }

  await saveSourcingOrder(order);
  await createAlibabaIntegrationLog({
    orderId: order.id,
    action: "checkout-order-created",
    endpoint: "internal",
    status: "success",
    requestBody: {
      shippingMethod: order.shippingMethod,
      totalPrice: formatFcfa(order.totalPriceFcfa),
    },
    responseBody: {
      orderNumber: order.orderNumber,
      freightStatus: order.freightStatus,
      supplierOrderStatus: order.supplierOrderStatus,
      alibabaTradeIds: order.alibabaTradeIds,
    },
  });

  return order;
}

export async function triggerSeaContainerShipment(containerId: string) {
  throw new Error("Le groupage maritime est desactive. Lancez chaque commande payee depuis sa fiche detail.");
}
