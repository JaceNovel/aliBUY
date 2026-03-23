import type { SourcingOrder } from "@/lib/alibaba-sourcing";
import { getMonerooCurrencyCode, normalizeMonerooPaymentStatus, type MonerooPaymentRecord } from "@/lib/moneroo";
import { getSourcingOrderById, getSourcingOrderByMonerooPaymentId, saveSourcingOrder } from "@/lib/sourcing-store";

type PersistMonerooPaymentOptions = {
  order: SourcingOrder;
  payment: MonerooPaymentRecord;
  verified?: boolean;
  keepExistingCheckoutUrl?: boolean;
};

export function applyMonerooPaymentToOrder({ order, payment, verified = false, keepExistingCheckoutUrl = false }: PersistMonerooPaymentOptions): SourcingOrder {
  const timestamp = new Date().toISOString();
  const normalizedStatus = normalizeMonerooPaymentStatus(payment.status);

  return {
    ...order,
    paymentStatus: normalizedStatus === "unpaid" ? order.paymentStatus : normalizedStatus,
    paymentProvider: "moneroo",
    paymentCurrency: getMonerooCurrencyCode(payment) || order.paymentCurrency || "XOF",
    monerooPaymentId: payment.id || order.monerooPaymentId,
    monerooCheckoutUrl: keepExistingCheckoutUrl ? order.monerooCheckoutUrl : payment.checkout_url || order.monerooCheckoutUrl,
    monerooPaymentStatus: payment.status || order.monerooPaymentStatus,
    monerooPaymentPayload: payment,
    monerooInitializedAt: order.monerooInitializedAt || payment.initiated_at || timestamp,
    monerooVerifiedAt: verified ? timestamp : order.monerooVerifiedAt,
    paidAt: normalizedStatus === "paid" ? (payment.processed_at || order.paidAt || timestamp) : order.paidAt,
    updatedAt: timestamp,
  };
}

export async function persistMonerooPaymentToOrder(options: PersistMonerooPaymentOptions) {
  const nextOrder = applyMonerooPaymentToOrder(options);
  await saveSourcingOrder(nextOrder);
  return nextOrder;
}

export async function resolveSourcingOrderForMoneroo(input: {
  orderId?: string | null;
  paymentId?: string | null;
  metadata?: Record<string, string> | null;
}) {
  if (input.orderId) {
    const order = await getSourcingOrderById(input.orderId);
    if (order) {
      return order;
    }
  }

  if (input.paymentId) {
    const order = await getSourcingOrderByMonerooPaymentId(input.paymentId);
    if (order) {
      return order;
    }
  }

  const metadataOrderId = input.metadata?.orderId || input.metadata?.order_id;
  if (metadataOrderId) {
    return getSourcingOrderById(metadataOrderId);
  }

  return null;
}