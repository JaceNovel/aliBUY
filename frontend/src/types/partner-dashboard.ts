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
  secretAvailable?: boolean;
  webhookUrl: string;
};

export type PartnerWithdrawalMethod = "bank_transfer" | "mobile_money";

export type PartnerWithdrawalStatus = "pending" | "approved" | "rejected";

export type PartnerWithdrawalRecord = {
  id: string;
  partnerId: string;
  amount: number;
  method: PartnerWithdrawalMethod;
  status: PartnerWithdrawalStatus;
  bankAccountName?: string | null;
  bankName?: string | null;
  iban?: string | null;
  swiftCode?: string | null;
  mobileMoneyNumber?: string | null;
  mobileMoneyCountryCode?: string | null;
  mobileMoneyOperator?: string | null;
  adminNote?: string | null;
  processedAt?: string | null;
  createdAt: string | null;
  estimatedProcessingDelayHours: number;
};

export type PartnerWithdrawalsResponse = {
  activeBalance: number;
  canRequest: boolean;
  nextEligibleAt: string | null;
  items: PartnerWithdrawalRecord[];
};

export type PartnerWithdrawalRequestPayload = {
  amount: number;
  method: PartnerWithdrawalMethod;
  bankAccountName?: string;
  bankName?: string;
  iban?: string;
  swiftCode?: string;
  mobileMoneyNumber?: string;
  mobileMoneyCountryCode?: string;
  mobileMoneyOperator?: string;
};

export type AdminPartnerWithdrawalRecord = PartnerWithdrawalRecord & {
  partner: {
    id: string;
    companyName: string;
    email: string;
    walletBalance: number;
  };
};

export type PartnerPortalRequestSummary = {
  companyName: string;
  website: string | null;
  description: string;
  decisionReason?: string | null;
  reviewedAt?: string | null;
  createdAt: string | null;
};

export type PartnerPortalAccountSummary = {
  id: string;
  companyName: string;
  email: string;
  webhookUrl: string | null;
  isActive: boolean;
  deactivatedReason?: string | null;
  deactivatedAt?: string | null;
  walletBalance: number;
  createdAt: string | null;
};

export type PartnerPortalAccessResponse = {
  status: "guest" | "none" | "pending" | "approved" | "rejected" | "blocked";
  hasDashboardAccess: boolean;
  email: string | null;
  request: PartnerPortalRequestSummary | null;
  partner: PartnerPortalAccountSummary | null;
};