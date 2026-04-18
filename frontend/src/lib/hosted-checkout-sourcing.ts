import type { SourcingOrder } from "@/lib/alibaba-sourcing";
import { registerFreeDealClaimFromPaidOrder } from "@/lib/free-deal-store";
import { triggerManyChatOrderPaidFlow } from "@/lib/manychat";
import { incrementProductSalesCounts } from "@/lib/products-feed";
import { repairBlockedSourcingOrderForSupplierPayment, syncSourcingOrderForDeferredSupplierPayment } from "@/lib/sourcing-batch-service";
import { saveSourcingOrder } from "@/lib/sourcing-store";

type HostedCheckoutProvider = "moneroo" | "paypal";

type HostedCheckoutSnapshot = {
  provider: HostedCheckoutProvider;
  id: string;
  status?: string;
  normalizedStatus: SourcingOrder["paymentStatus"];
  checkoutUrl?: string;
  currency?: string;
  payload?: unknown;
  initiatedAt?: string;
  processedAt?: string;
};

type PersistHostedCheckoutOptions = {
  order: SourcingOrder;
  payment: HostedCheckoutSnapshot;
  verified?: boolean;
  keepExistingCheckoutUrl?: boolean;
};

export function applyHostedCheckoutPaymentToOrder({ order, payment, verified = false, keepExistingCheckoutUrl = false }: PersistHostedCheckoutOptions): SourcingOrder {
  const timestamp = new Date().toISOString();

  return {
    ...order,
    paymentStatus: payment.normalizedStatus === "unpaid" ? order.paymentStatus : payment.normalizedStatus,
    paymentProvider: payment.provider,
    paymentCurrency: order.paymentCurrency || payment.currency || "XOF",
    monerooPaymentId: payment.id || order.monerooPaymentId,
    monerooCheckoutUrl: keepExistingCheckoutUrl ? order.monerooCheckoutUrl : payment.checkoutUrl || order.monerooCheckoutUrl,
    monerooPaymentStatus: payment.status || order.monerooPaymentStatus,
    monerooPaymentPayload: payment.payload ?? order.monerooPaymentPayload,
    monerooInitializedAt: order.monerooInitializedAt || payment.initiatedAt || timestamp,
    monerooVerifiedAt: verified ? timestamp : order.monerooVerifiedAt,
    paidAt: payment.normalizedStatus === "paid" ? (payment.processedAt || order.paidAt || timestamp) : order.paidAt,
    updatedAt: timestamp,
  };
}

export async function persistHostedCheckoutPaymentToOrder(options: PersistHostedCheckoutOptions) {
  const wasAlreadyPaid = options.order.paymentStatus === "paid";
  let nextOrder = applyHostedCheckoutPaymentToOrder(options);
  await saveSourcingOrder(nextOrder);

  if (!wasAlreadyPaid && nextOrder.paymentStatus === "paid") {
    if (nextOrder.supplierOrderStatus !== "created" || nextOrder.alibabaTradeIds.length === 0) {
      nextOrder = await repairBlockedSourcingOrderForSupplierPayment(nextOrder.id).catch(() => nextOrder);
    }

    if (nextOrder.supplierOrderStatus === "created" && nextOrder.alibabaTradeIds.length > 0) {
      nextOrder = await syncSourcingOrderForDeferredSupplierPayment(nextOrder, "moneroo-verify").catch(() => nextOrder);
    }

    await incrementProductSalesCounts(nextOrder.items.map((item) => ({
      slug: item.slug,
      quantity: item.quantity,
    })));
    await registerFreeDealClaimFromPaidOrder(nextOrder).catch(() => null);
    await triggerManyChatOrderPaidFlow(nextOrder).catch((error: unknown) => {
      console.error("[manychat] paid flow trigger failed", {
        orderId: nextOrder.id,
        reason: error instanceof Error ? error.message : "unknown",
      });
    });
  }

  return nextOrder;
}