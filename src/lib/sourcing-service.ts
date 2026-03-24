import { formatFcfa, type SourcingCheckoutInput, type SourcingOrder, type SourcingSeaContainer, type SourcingSettings } from "@/lib/alibaba-sourcing";
import { createAlibabaSourcingQuote, getAlibabaSourcingCatalog } from "@/lib/alibaba-sourcing-server";
import { runAlibabaSupplierAutomation } from "@/lib/alibaba-open-platform-client";
import { createAlibabaIntegrationLog, createSourcingIds, getAlibabaCatalogMappings, getSourcingOrders, getSourcingSeaContainers, getSourcingSettings, saveSourcingOrder, saveSourcingSeaContainer, saveSourcingSettings } from "@/lib/sourcing-store";

function nowIso() {
  return new Date().toISOString();
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
  const settings = await getSourcingSettings();
  const quote = await createAlibabaSourcingQuote(input.items, settings);
  const shippingOption = quote.shippingOptions.find((option) => option.key === input.shippingMethod);

  if (!shippingOption) {
    throw new Error("La methode de livraison selectionnee n'est pas disponible pour ce panier.");
  }

  const existingOrders = await getSourcingOrders();
  const timestamp = nowIso();

  let order: SourcingOrder = {
    id: createSourcingIds(),
    orderNumber: createOrderNumber(existingOrders.length),
    userId: input.userId,
    customerAddressId: input.customerAddressId,
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    customerPhone: input.customerPhone,
    addressLine1: input.addressLine1,
    addressLine2: input.addressLine2,
    city: input.city,
    state: input.state,
    postalCode: input.postalCode,
    countryCode: input.countryCode,
    shippingMethod: input.shippingMethod,
    shippingCostFcfa: shippingOption.priceFcfa,
    cartProductsTotalFcfa: quote.cartProductsTotalFcfa,
    totalPriceFcfa: quote.cartProductsTotalFcfa + shippingOption.priceFcfa,
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

  const mappings = await getAlibabaCatalogMappings();
  const integration = await runAlibabaSupplierAutomation(order, mappings);
  order = {
    ...order,
    freightStatus: integration.freightStatus,
    supplierOrderStatus: integration.supplierOrderStatus,
    alibabaTradeIds: integration.alibabaTradeIds,
    freightPayload: integration.freightPayload,
    supplierOrderPayload: integration.supplierOrderPayload,
    status: integration.supplierOrderStatus === "created" ? "submitted_to_supplier" : order.status,
    updatedAt: nowIso(),
  };

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