import {
  formatFcfa,
  resolveSourcingDeliveryPlan,
  type SourcingCheckoutInput,
  type SourcingOrder,
  type SourcingSeaContainer,
  type SourcingSettings,
  withSourcingOrderMeta,
} from "@/lib/alibaba-sourcing";
import { createAlibabaSourcingQuote, getAlibabaSourcingCatalog } from "@/lib/alibaba-sourcing-server";
import { getSharedCartByToken, markSharedCartOrdered } from "@/lib/cart-share-store";
import { createAlibabaSupplierOrders, verifyAlibabaSupplierFreight } from "@/lib/alibaba-open-platform-client";
import { consumePromoCode, validatePromoCodeForAmount } from "@/lib/promo-codes-store";
import { createAlibabaIntegrationLog, createSourcingIds, getAlibabaCatalogMappings, getSourcingOrders, getSourcingSeaContainers, getSourcingSettings, saveSourcingOrder, saveSourcingSeaContainer, saveSourcingSettings } from "@/lib/sourcing-store";

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
    catalog: (await getAlibabaSourcingCatalog(settings)).slice(0, 8),
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
  const containers = await getSourcingSeaContainers();
  const activeContainer = containers.find((container) => container.status === "pending" || container.status === "ready_to_ship");
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
  const persistedUserId = normalizePersistedUserId(input.userId);
  const settings = await getSourcingSettings();
  const deliveryPlan = resolveSourcingDeliveryPlan({
    countryCode: input.countryCode,
    city: input.city,
    deliveryProfile: input.deliveryProfile,
  });

  if (!deliveryPlan.supported) {
    throw new Error(deliveryPlan.unsupportedMessage ?? "Cette destination n'est pas prise en charge en livraison directe.");
  }

  const quote = await createAlibabaSourcingQuote(input.items, settings, {
    disableFreeAir: !deliveryPlan.workflow.freeDeliveryEligible,
  });
  const shippingOption = quote.shippingOptions.find((option) => option.key === input.shippingMethod);

  if (!shippingOption) {
    throw new Error("La methode de livraison selectionnee n'est pas disponible pour ce panier.");
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
    status: input.shippingMethod === "sea" ? "grouped_sea" : "checkout_created",
    freightStatus: "not_requested",
    supplierOrderStatus: "not_created",
    paymentStatus: "unpaid",
    paymentProvider: "moneroo",
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
      createdFromSharedCart: Boolean(sharedCart),
      thirdPartyCreatorName: sharedCart?.ownerDisplayName,
      thirdPartyCreatorEmail: sharedCart?.ownerEmail,
    },
  });

  if (input.shippingMethod === "sea") {
    const container = await assignOrderToSeaContainer(order, settings);
    order = {
      ...order,
      containerId: container.id,
      status: container.status === "ready_to_ship" ? "ready_to_ship" : "grouped_sea",
      updatedAt: nowIso(),
    };
  }

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

  const mappings = await getAlibabaCatalogMappings();
  try {
    const freightVerification = await verifyAlibabaSupplierFreight(order, mappings);
    order = {
      ...order,
      freightStatus: freightVerification.freightStatus,
      freightPayload: freightVerification.freightPayload,
      updatedAt: nowIso(),
    };
    await saveSourcingOrder(order);

    const supplierOrders = await createAlibabaSupplierOrders(order, mappings, freightVerification);
    order = {
      ...order,
      supplierOrderStatus: supplierOrders.supplierOrderStatus,
      alibabaTradeIds: supplierOrders.alibabaTradeIds,
      supplierOrderPayload: supplierOrders.supplierOrderPayload,
      status: supplierOrders.supplierOrderStatus === "created" ? "submitted_to_supplier" : order.status,
      updatedAt: nowIso(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "supplier_automation_failed";
    order = {
      ...order,
      freightStatus: "failed",
      supplierOrderStatus: "failed",
      supplierOrderPayload: { error: message },
      updatedAt: nowIso(),
    };

    await createAlibabaIntegrationLog({
      orderId: order.id,
      action: "supplier-automation",
      endpoint: "internal",
      status: "failed",
      requestBody: {
        orderNumber: order.orderNumber,
        shippingMethod: order.shippingMethod,
      },
      responseBody: { message },
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
  const containers = await getSourcingSeaContainers();
  const container = containers.find((entry) => entry.id === containerId);

  if (!container) {
    throw new Error("Conteneur introuvable.");
  }

  const nextContainer: SourcingSeaContainer = {
    ...container,
    status: "shipped",
    shipmentTriggeredAt: nowIso(),
    updatedAt: nowIso(),
  };
  await saveSourcingSeaContainer(nextContainer);

  const orders = await getSourcingOrders();
  for (const order of orders.filter((entry) => entry.containerId === containerId)) {
    await saveSourcingOrder({
      ...order,
      status: "shipment_triggered",
      updatedAt: nowIso(),
    });
  }

  return nextContainer;
}