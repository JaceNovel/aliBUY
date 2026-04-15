import { randomUUID } from "node:crypto";

import { env } from "@/lib/env";

export type PaymentStatus = "unpaid" | "initialized" | "pending" | "paid" | "failed" | "cancelled";

export type PayPalOrderRecord = {
  id: string;
  status?: string;
  intent?: string;
  links?: Array<{
    href?: string;
    rel?: string;
    method?: string;
  }>;
  purchase_units?: Array<{
    reference_id?: string;
    amount?: {
      currency_code?: string;
      value?: string;
    };
    payments?: {
      captures?: Array<{
        id?: string;
        status?: string;
        create_time?: string;
        update_time?: string;
      }>;
    };
  }>;
};

type PayPalCreateOrderPayload = {
  amount: number;
  currency: string;
  description: string;
  return_url: string;
  cancel_url?: string;
  metadata?: Record<string, string>;
};

const PAYPAL_LIVE_API_BASE_URL = "https://api-m.paypal.com";
const PAYPAL_SANDBOX_API_BASE_URL = "https://api-m.sandbox.paypal.com";

function getPayPalApiBaseUrl() {
  const configured = env.paypalApiUrl?.trim();
  if (configured) {
    return configured;
  }

  return env.paypalEnvironment === "sandbox" ? PAYPAL_SANDBOX_API_BASE_URL : PAYPAL_LIVE_API_BASE_URL;
}

function getPayPalClientId() {
  const clientId = env.paypalClientId?.trim();
  if (!clientId) {
    throw new Error("PAYPAL_CLIENT_ID is required to initialize or verify PayPal payments.");
  }

  return clientId;
}

function getPayPalClientSecret() {
  const clientSecret = env.paypalClientSecret?.trim();
  if (!clientSecret) {
    throw new Error("PAYPAL_CLIENT_SECRET is required to initialize or verify PayPal payments.");
  }

  return clientSecret;
}

async function getAccessToken() {
  const credentials = Buffer.from(`${getPayPalClientId()}:${getPayPalClientSecret()}`, "utf8").toString("base64");
  const response = await fetch(`${getPayPalApiBaseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }).toString(),
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null) as { access_token?: string; error_description?: string; error?: string } | null;
  if (!response.ok || !payload?.access_token) {
    throw new Error(payload?.error_description || payload?.error || `PayPal auth failed with status ${response.status}.`);
  }

  return payload.access_token;
}

async function paypalRequest<T>(pathname: string, init?: RequestInit) {
  const accessToken = await getAccessToken();
  const response = await fetch(`${getPayPalApiBaseUrl()}${pathname}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok || !payload) {
    const details = Array.isArray(payload?.details) ? payload.details : [];
    const detailMessage = details.find((entry) => typeof entry === "object" && entry && typeof (entry as { description?: unknown }).description === "string") as { description?: string } | undefined;
    throw new Error(String(payload?.message || detailMessage?.description || `PayPal request failed with status ${response.status}.`));
  }

  return payload as T;
}

function resolvePayPalChargeAmount(amount: number, currency: string) {
  const normalizedCurrency = currency.trim().toUpperCase() || "XOF";

  if (normalizedCurrency === "XOF") {
    const fallbackCurrency = (env.paypalFallbackCurrency || "EUR").trim().toUpperCase();
    const rate = Number(env.paypalXofPerEur || 655.957);
    if (!fallbackCurrency || !Number.isFinite(rate) || rate <= 0) {
      throw new Error("PayPal conversion is not configured for XOF amounts.");
    }

    return {
      currencyCode: fallbackCurrency,
      value: (amount / rate).toFixed(2),
    };
  }

  return {
    currencyCode: normalizedCurrency,
    value: amount.toFixed(2),
  };
}

export function extractPayPalCheckoutUrl(order: PayPalOrderRecord) {
  return order.links?.find((link) => link.rel === "approve")?.href;
}

export function getPayPalCurrencyCode(order: PayPalOrderRecord) {
  return order.purchase_units?.[0]?.amount?.currency_code;
}

export function getPayPalProcessedAt(order: PayPalOrderRecord) {
  return order.purchase_units?.[0]?.payments?.captures?.[0]?.update_time
    || order.purchase_units?.[0]?.payments?.captures?.[0]?.create_time;
}

export function normalizePayPalPaymentStatus(status: string | null | undefined): PaymentStatus {
  switch ((status || "").trim().toLowerCase()) {
    case "created":
      return "initialized";
    case "approved":
    case "payer_action_required":
    case "pending":
      return "pending";
    case "completed":
    case "captured":
    case "paid":
      return "paid";
    case "voided":
    case "cancelled":
    case "canceled":
      return "cancelled";
    case "failed":
    case "declined":
    case "denied":
      return "failed";
    default:
      return "unpaid";
  }
}

export async function initializePayPalPayment(input: PayPalCreateOrderPayload) {
  const charge = resolvePayPalChargeAmount(input.amount, input.currency);

  return paypalRequest<PayPalOrderRecord>("/v2/checkout/orders", {
    method: "POST",
    headers: {
      "PayPal-Request-Id": `afripay-create-${randomUUID()}`,
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: input.metadata?.orderNumber || input.metadata?.orderId || randomUUID(),
          custom_id: input.metadata?.orderId || undefined,
          description: input.description,
          amount: {
            currency_code: charge.currencyCode,
            value: charge.value,
          },
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: "AfriPay",
            landing_page: "LOGIN",
            user_action: "PAY_NOW",
            return_url: input.return_url,
            cancel_url: input.cancel_url || input.return_url,
          },
        },
      },
    }),
  });
}

export async function getPayPalOrder(orderId: string) {
  return paypalRequest<PayPalOrderRecord>(`/v2/checkout/orders/${encodeURIComponent(orderId)}`, {
    method: "GET",
  });
}

export async function capturePayPalOrder(orderId: string) {
  return paypalRequest<PayPalOrderRecord>(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: "POST",
    headers: {
      "PayPal-Request-Id": `afripay-capture-${orderId}`,
    },
    body: JSON.stringify({}),
  });
}

export async function verifyPayPalPayment(orderId: string) {
  const order = await getPayPalOrder(orderId);
  if ((order.status || "").toUpperCase() === "APPROVED") {
    return capturePayPalOrder(orderId);
  }

  return order;
}