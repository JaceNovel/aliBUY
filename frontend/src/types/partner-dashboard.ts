export type PartnerDashboardStats = {
  balance: number;
  revenueToday: number;
  ordersCount: number;
  revenueSeries: Array<{
    day: string;
    amount: number;
  }>;
  companyName: string;
};

export type PartnerOrderStatus = "paid" | "pending";

export type PartnerOrderRecord = {
  id: string;
  product: string;
  price: number;
  margin: number;
  status: PartnerOrderStatus;
  createdAt: string;
};

export type PartnerOrdersResponse = {
  items: PartnerOrderRecord[];
  pagination: {
    currentPage: number;
    perPage: number;
    total: number;
    lastPage: number;
  };
};

export type PartnerWalletTransaction = {
  id: string;
  amount: number;
  type: "credit" | "debit";
  description: string;
  createdAt: string;
};

export type PartnerWallet = {
  partnerId: string;
  balance: number;
  transactions: PartnerWalletTransaction[];
};

export type PartnerApiKeys = {
  appKey: string;
  maskedSecret: string;
  revealableSecret?: string;
  webhookUrl: string;
};