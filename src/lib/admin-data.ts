import "server-only";

import { type AdminSectionSlug } from "@/lib/admin-config";
import { getCatalogCategories } from "@/lib/catalog-category-service";
import { getCatalogProducts } from "@/lib/catalog-service";
import { getQuoteRequests, getSupportConversations } from "@/lib/customer-data-store";
import { getSourcingOrders } from "@/lib/sourcing-store";
import { getStoredUsers } from "@/lib/user-store";

export type AdminOrderRecord = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingMethod: string;
  paymentStatus: string;
  status: string;
  countryCode: string;
  addressLine: string;
  totalUsd: number;
  createdAt: string;
  href: string;
};

export type AdminImportRequestStatus = "En attente" | "En traitement" | "Complété" | "Rejeté";

export type AdminImportRequest = {
  requestCode: string;
  orderId: string;
  clientName: string;
  email: string;
  phone: string;
  product: string;
  productUrl: string;
  productDescription: string;
  budget: string;
  additionalInfo: string;
  quantity: number;
  dateLabel: string;
  createdAt: string;
  updatedLabel: string;
  status: AdminImportRequestStatus;
  corridor: string;
  tracking: string;
  agent: string;
  href: string;
};


function convertFcfaToUsd(amountFcfa: number) {
  return Number((amountFcfa / 610).toFixed(2));
}

export async function getAdminSuppliers() {
  const products = await getCatalogProducts();
  const supplierMap = new Map<
    string,
    {
      name: string;
      location: string;
      yearsInBusiness: number;
      productCount: number;
      responseTime: string;
      status: string;
    }
  >();

  for (const product of products) {
    const existing = supplierMap.get(product.supplierName);

    if (existing) {
      existing.productCount += 1;
      continue;
    }

    supplierMap.set(product.supplierName, {
      name: product.supplierName,
      location: product.supplierLocation,
      yearsInBusiness: product.yearsInBusiness,
      productCount: 1,
      responseTime: product.responseTime,
      status: product.yearsInBusiness >= 6 ? "Verifie" : "A suivre",
    });
  }

  return Array.from(supplierMap.values()).sort((left, right) => right.productCount - left.productCount);
}

export async function getAdminMetrics() {
  const [suppliers, users, orders, products, categories] = await Promise.all([
    getAdminSuppliers(),
    getStoredUsers(),
    getSourcingOrders(),
    getCatalogProducts(),
    getCatalogCategories(),
  ]);
  const revenueUsd = orders.reduce((sum, order) => sum + convertFcfaToUsd(order.totalPriceFcfa), 0);
  const promotionsCount = products.filter((product) => product.badge || product.title.toLowerCase().includes("promo")).length;
  const pendingOrdersCount = orders.filter((order) => order.paymentStatus !== "paid").length;

  return {
    revenueUsd,
    ordersCount: orders.length,
    productsCount: products.length,
    suppliersCount: users.length,
    categoriesCount: categories.length,
    promotionsCount,
    pendingOrdersCount,
  };
}

export async function getAdminMonthlyRevenue() {
  const monthLabels = ["Jan", "Fev", "Mar", "Avr", "Mai", "Juin"];
  const revenueByMonth = new Map<number, number>();
  const orders = await getSourcingOrders();

  for (const order of orders) {
    const monthIndex = new Date(order.createdAt).getUTCMonth();
    revenueByMonth.set(monthIndex, (revenueByMonth.get(monthIndex) ?? 0) + convertFcfaToUsd(order.totalPriceFcfa));
  }

  return monthLabels.map((label, index) => ({
    label,
    value: revenueByMonth.get(index) ?? 0,
  }));
}

export async function getAdminRecentOrders(limit = 5) {
  const orders = await getSourcingOrders();

  return [...orders]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, limit)
    .map((order) => ({
      id: order.orderNumber,
      customer: order.customerName,
      product: order.items[0]?.title ?? `Commande ${order.orderNumber}`,
      date: order.createdAt.slice(0, 10),
      totalUsd: convertFcfaToUsd(order.totalPriceFcfa),
      status: order.paymentStatus,
      href: `/admin/orders/${encodeURIComponent(order.id)}`,
    }));
}

export async function getAdminOrders(): Promise<AdminOrderRecord[]> {
  const orders = await getSourcingOrders();

  return [...orders]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      customerPhone: order.customerPhone,
      shippingMethod: order.shippingMethod,
      paymentStatus: order.paymentStatus,
      status: order.status,
      countryCode: order.countryCode,
      addressLine: [order.addressLine1, order.addressLine2, `${order.city}, ${order.state}`, order.postalCode].filter(Boolean).join(", "),
      totalUsd: convertFcfaToUsd(order.totalPriceFcfa),
      createdAt: order.createdAt,
      href: `/admin/orders/${encodeURIComponent(order.id)}`,
    }));
}

export async function getAdminOrderById(orderId: string) {
  const orders = await getSourcingOrders();
  return orders.find((order) => order.id === orderId || order.orderNumber === orderId) ?? null;
}

export async function getAdminPromotions() {
  const products = await getCatalogProducts();
  return products
    .filter((product) => product.badge || product.title.toLowerCase().includes("promo"))
    .map((product) => ({
      name: product.shortTitle,
      badge: product.badge ?? "Promo",
      priceMinUsd: product.minUsd,
      priceMaxUsd: product.maxUsd,
      href: `/products/${product.slug}`,
    }));
}

export const adminPromoCodes: Array<{ code: string; type: string; value: string; minPurchase: string; usages: string; validity: string; status: string; channel: string; href: string }> = [];

export async function getAdminOffers() {
  const products = await getCatalogProducts();
  return products.slice(0, 8).map((product) => ({
    name: product.shortTitle,
    supplier: product.supplierName,
    moq: `${product.moq} ${product.unit}`,
    priceMinUsd: product.minUsd,
    category: product.slug.includes("gaming") ? "Gaming" : product.slug.includes("vr") ? "Immersif" : "Lifestyle",
    href: `/products/${product.slug}`,
  }));
}

export const adminEmailCampaigns: Array<{ subject: string; segment: string; status: string; href: string }> = [];

export async function getAdminSupportTickets() {
  const conversations = await getSupportConversations();
  return conversations.map((conversation) => ({
    subject: conversation.preview,
    owner: conversation.name,
    priority: conversation.status === "en ligne" ? "Normale" : conversation.status === "en transit" ? "Moyenne" : "Cloture",
    status: conversation.status,
    href: `/messages?conversationId=${encodeURIComponent(conversation.id)}`,
  }));
}

export async function getAdminImportRequests() {
  const requests = await getQuoteRequests();
  return requests.map((request) => ({
    requestCode: `imp-${request.id.slice(0, 6)}`,
    orderId: request.id,
    clientName: request.userDisplayName,
    email: request.userEmail,
    phone: "Non renseigne",
    product: request.productName,
    productUrl: "",
    productDescription: request.specifications,
    budget: request.budget || "Sur demande",
    additionalInfo: request.notes || "Aucune information complementaire fournie.",
    quantity: Number.parseInt(request.quantity.replace(/[^0-9]/g, ""), 10) || 0,
    dateLabel: new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(request.createdAt)),
    createdAt: new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(request.createdAt)),
    updatedLabel: `Mis a jour ${new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(request.updatedAt))}`,
    status: request.status,
    corridor: request.shippingWindow,
    tracking: "En attente",
    agent: "Equipe sourcing",
    href: `/admin/imports/${encodeURIComponent(request.id)}`,
  } satisfies AdminImportRequest));
}

export async function getAdminImportRequestById(importId: string) {
  const requests = await getAdminImportRequests();
  return requests.find((request) => request.orderId === importId) ?? null;
}

export function getAdminReviews() {
  return [] as Array<{ product: string; score: number; reviewer: string; summary: string; status: string; responseStatus: string; href: string }>;
}

export const adminSettingsGroups = [
  { label: "Localisation", detail: "Pays FR par defaut, devise contextualisee et langue derivee.", href: "/pricing" },
  { label: "Support vendeur", detail: "Canaux messages relies aux agents logistiques et service client.", href: "/messages" },
  { label: "Catalogue", detail: "Moteur de recherche, suggestions et taxonomie produits centralises.", href: "/products" },
];
