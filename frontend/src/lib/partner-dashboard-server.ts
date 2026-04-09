import type { PartnerApiKeys, PartnerDashboardStats, PartnerOrdersResponse, PartnerWallet } from "@/types/partner-dashboard";

const apiBaseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000").trim().replace(/\/$/, "");
const partnerAppKey = (process.env.PARTNER_DASHBOARD_APP_KEY ?? "").trim();
const partnerAppSecret = (process.env.PARTNER_DASHBOARD_APP_SECRET ?? "").trim();
const allowSecretReveal = process.env.PARTNER_DASHBOARD_EXPOSE_SECRET === "1";

const MOCK_SECRET = "sec_live_demo_4ef80c1d7a3a9f5d4d2e";
const MOCK_APP_KEY = "afripay_live_demo7f9ac44e9e2d1b58";

export const partnerDashboardMocks = {
  stats: {
    balance: 12500,
    revenueToday: 2350,
    ordersCount: 18,
    companyName: "Sahel Commerce",
    revenueSeries: [
      { day: "Lun", amount: 1200 },
      { day: "Mar", amount: 1640 },
      { day: "Mer", amount: 980 },
      { day: "Jeu", amount: 2100 },
      { day: "Ven", amount: 1740 },
      { day: "Sam", amount: 2680 },
      { day: "Dim", amount: 2350 },
    ],
  } satisfies PartnerDashboardStats,
  orders: {
    items: [
      { id: "AFR-P-1042", product: "Ecouteurs Bluetooth Pro", price: 1200, margin: 200, status: "paid", createdAt: "2026-04-09T10:15:00.000Z" },
      { id: "AFR-P-1041", product: "Mini projecteur LED", price: 2400, margin: 350, status: "pending", createdAt: "2026-04-09T08:20:00.000Z" },
      { id: "AFR-P-1039", product: "Montre connectee Pulse X", price: 1900, margin: 280, status: "paid", createdAt: "2026-04-08T17:10:00.000Z" },
      { id: "AFR-P-1035", product: "Chargeur GaN 65W", price: 1700, margin: 250, status: "paid", createdAt: "2026-04-08T11:02:00.000Z" },
      { id: "AFR-P-1032", product: "Ring light studio", price: 1600, margin: 190, status: "pending", createdAt: "2026-04-07T14:28:00.000Z" },
    ],
    pagination: {
      currentPage: 1,
      perPage: 10,
      total: 5,
      lastPage: 1,
    },
  } satisfies PartnerOrdersResponse,
  wallet: {
    partnerId: "partner-demo-1",
    balance: 12500,
    transactions: [
      { id: "txn_1", amount: 200, type: "credit", description: "Commande AFR-P-1042 payee", createdAt: "2026-04-09T10:30:00.000Z" },
      { id: "txn_2", amount: 150, type: "credit", description: "Commande AFR-P-1039 payee", createdAt: "2026-04-08T17:32:00.000Z" },
      { id: "txn_3", amount: 500, type: "debit", description: "Retrait wallet Orange Money", createdAt: "2026-04-07T09:05:00.000Z" },
    ],
  } satisfies PartnerWallet,
};

export function getMockApiKeys(): PartnerApiKeys {
  return {
    appKey: MOCK_APP_KEY,
    maskedSecret: `${"*".repeat(Math.max(MOCK_SECRET.length - 6, 8))}${MOCK_SECRET.slice(-6)}`,
    revealableSecret: MOCK_SECRET,
    webhookUrl: "https://partner.sahel-commerce.com/webhooks/afripay",
  };
}

function hasPartnerCredentials() {
  return partnerAppKey.length > 0 && partnerAppSecret.length > 0;
}

async function backendPartnerFetch<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: {
      "X-APP-KEY": partnerAppKey,
      "X-APP-SECRET": partnerAppSecret,
    },
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string"
      ? payload.message
      : "Partner API request failed.";
    throw new Error(message);
  }

  return payload as T;
}

export async function getServerOrders(page = 1): Promise<PartnerOrdersResponse> {
  if (!hasPartnerCredentials()) {
    return partnerDashboardMocks.orders;
  }

  const payload = await backendPartnerFetch<{
    items: Array<{
      id: string;
      order_id: string;
      margin: number;
      selling_price: number;
      status: "paid" | "pending";
      created_at: string;
    }>;
    pagination: {
      current_page: number;
      per_page: number;
      total: number;
      last_page: number;
    };
  }>(`/api/partner/orders?page=${page}`);

  return {
    items: payload.items.map((item) => ({
      id: item.id,
      product: `Commande ${item.order_id}`,
      price: item.selling_price,
      margin: item.margin,
      status: item.status,
      createdAt: item.created_at,
    })),
    pagination: {
      currentPage: payload.pagination.current_page,
      perPage: payload.pagination.per_page,
      total: payload.pagination.total,
      lastPage: payload.pagination.last_page,
    },
  };
}

export async function getServerWallet(): Promise<PartnerWallet> {
  if (!hasPartnerCredentials()) {
    return partnerDashboardMocks.wallet;
  }

  const payload = await backendPartnerFetch<{
    partner_id: string;
    balance: number;
    transactions: Array<{
      id: string;
      amount: number;
      type: "credit" | "debit";
      description: string;
      created_at: string;
    }>;
  }>("/api/partner/balance");

  return {
    partnerId: payload.partner_id,
    balance: payload.balance,
    transactions: payload.transactions.map((transaction) => ({
      id: transaction.id,
      amount: transaction.amount,
      type: transaction.type,
      description: transaction.description,
      createdAt: transaction.created_at,
    })),
  };
}

export async function getServerStats(): Promise<PartnerDashboardStats> {
  if (!hasPartnerCredentials()) {
    return partnerDashboardMocks.stats;
  }

  const [orders, wallet] = await Promise.all([getServerOrders(), getServerWallet()]);
  const revenueToday = orders.items
    .filter((order) => order.status === "paid")
    .reduce((sum, order) => sum + order.margin, 0);

  return {
    ...partnerDashboardMocks.stats,
    balance: wallet.balance,
    revenueToday: revenueToday || partnerDashboardMocks.stats.revenueToday,
    ordersCount: orders.pagination.total,
  };
}

export async function getServerApiKeys(): Promise<PartnerApiKeys> {
  if (!hasPartnerCredentials()) {
    return getMockApiKeys();
  }

  const maskedSecret = `${"*".repeat(Math.max(partnerAppSecret.length - 6, 8))}${partnerAppSecret.slice(-6)}`;

  return {
    appKey: partnerAppKey,
    maskedSecret,
    revealableSecret: allowSecretReveal ? partnerAppSecret : undefined,
    webhookUrl: process.env.PARTNER_DASHBOARD_WEBHOOK_URL?.trim() || "",
  };
}