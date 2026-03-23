import { createHmac, timingSafeEqual } from "node:crypto";

import type { PaymentStatus } from "@/lib/alibaba-sourcing";

export const MONEROO_DEFAULT_API_BASE_URL = "https://api.moneroo.io";

type MonerooEnvelope<T> = {
  message?: string;
  data?: T;
  errors?: unknown;
  success?: boolean;
};

export type MonerooPaymentRecord = {
  id: string;
  checkout_url?: string;
  status?: string;
  amount?: number;
  amount_formatted?: string;
  currency?: string | { code?: string };
  return_url?: string;
  environment?: string;
  initiated_at?: string;
  processed_at?: string;
  is_processed?: boolean;
  metadata?: Record<string, string>;
  customer?: {
    id?: string;
    email?: string;
    first_name?: string;
    last_name?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
  };
  method?: unknown;
  gateway?: unknown;
  capture?: unknown;
  context?: unknown;
};

export type MonerooInitializePayload = {
  amount: number;
  currency: string;
  description: string;
  return_url: string;
  customer: {
    email: string;
    first_name: string;
    last_name: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    zip?: string;
  };
  metadata?: Record<string, string>;
  methods?: string[];
  restrict_country_code?: string;
};

function getMonerooApiBaseUrl() {
  return process.env.MONEROO_API_BASE_URL?.trim() || MONEROO_DEFAULT_API_BASE_URL;
}

function getMonerooSecretKey() {
  const secretKey = process.env.MONEROO_SECRET_KEY?.trim();

  if (!secretKey) {
    throw new Error("MONEROO_SECRET_KEY is required to initialize or verify Moneroo payments.");
  }

  return secretKey;
}

function getMonerooWebhookSecret() {
  const webhookSecret = process.env.MONEROO_WEBHOOK_SECRET?.trim();

  if (!webhookSecret) {
    throw new Error("MONEROO_WEBHOOK_SECRET is required to validate Moneroo webhooks.");
  }

  return webhookSecret;
}

async function monerooRequest<T>(pathname: string, init?: RequestInit) {
  const response = await fetch(`${getMonerooApiBaseUrl()}${pathname}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getMonerooSecretKey()}`,
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null) as MonerooEnvelope<T> | null;

  if (!response.ok || !payload?.data) {
    const errorMessage = payload?.message || `Moneroo request failed with status ${response.status}.`;
    throw new Error(errorMessage);
  }

  return payload.data;
}

export async function initializeMonerooPayment(input: MonerooInitializePayload) {
  return monerooRequest<MonerooPaymentRecord>("/v1/payments/initialize", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function verifyMonerooPayment(paymentId: string) {
  return monerooRequest<MonerooPaymentRecord>(`/v1/payments/${encodeURIComponent(paymentId)}/verify`, {
    method: "GET",
  });
}

export async function getMonerooPayment(paymentId: string) {
  return monerooRequest<MonerooPaymentRecord>(`/v1/payments/${encodeURIComponent(paymentId)}`, {
    method: "GET",
  });
}

export function getMonerooCurrencyCode(payment: MonerooPaymentRecord) {
  if (typeof payment.currency === "string") {
    return payment.currency;
  }

  return payment.currency?.code || undefined;
}

export function normalizeMonerooPaymentStatus(status: string | null | undefined): PaymentStatus {
  switch ((status || "").toLowerCase()) {
    case "initiated":
      return "initialized";
    case "pending":
      return "pending";
    case "success":
      return "paid";
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
    default:
      return "unpaid";
  }
}

export function verifyMonerooWebhookSignature(rawBody: string, signatureHeader: string | null) {
  if (!signatureHeader) {
    return false;
  }

  const expectedSignature = createHmac("sha256", getMonerooWebhookSecret())
    .update(rawBody, "utf8")
    .digest("hex");
  const receivedSignature = signatureHeader.trim().toLowerCase();

  if (receivedSignature.length !== expectedSignature.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(receivedSignature, "utf8"), Buffer.from(expectedSignature, "utf8"));
}