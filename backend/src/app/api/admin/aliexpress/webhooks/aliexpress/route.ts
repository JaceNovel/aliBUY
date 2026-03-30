import { createHmac } from "node:crypto";

import { extractAlibabaTradeId } from "@/lib/alibaba-open-platform-client";
import { syncAlibabaPurchaseOrderByTradeId } from "@/lib/alibaba-operations-service";
import { createAlibabaIntegrationLog } from "@/lib/sourcing-store";

function buildSignature(body: string, appKey: string, appSecret: string) {
  return createHmac("sha256", appSecret)
    .update(`${appKey}${body}`, "utf8")
    .digest("hex")
    .toLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function findFirstString(value: unknown, keys: string[]): string | undefined {
  const queue: unknown[] = [value];
  const visited = new Set<object>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== "object") {
      continue;
    }

    if (visited.has(current as object)) {
      continue;
    }

    visited.add(current as object);

    if (Array.isArray(current)) {
      queue.push(...current);
      continue;
    }

    const record = current as Record<string, unknown>;
    for (const key of keys) {
      const candidate = record[key];
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate.trim();
      }
    }

    queue.push(...Object.values(record));
  }

  return undefined;
}

function parseWebhookPayload(rawBody: string) {
  const trimmed = rawBody.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const authorization = request.headers.get("authorization")?.toLowerCase() ?? "";
  const appKey = process.env.ALIEXPRESS_DS_WEBHOOK_APP_KEY?.trim() ?? "";
  const appSecret = process.env.ALIEXPRESS_DS_WEBHOOK_SECRET?.trim() ?? "";
  const payload = parseWebhookPayload(rawBody);
  const eventType = findFirstString(payload, ["eventType", "event_type", "bizType", "biz_type", "messageType", "message_type", "type"]);
  const tradeId = extractAlibabaTradeId(payload)
    ?? findFirstString(payload, ["tradeId", "trade_id", "orderId", "order_id", "aeOrderId", "ae_order_id"]);

  const expectedSignature = appKey && appSecret ? buildSignature(rawBody, appKey, appSecret) : "";
  const isValid = !expectedSignature || authorization === expectedSignature;

  let syncedOrder: Awaited<ReturnType<typeof syncAlibabaPurchaseOrderByTradeId>> | null = null;
  let syncError: string | undefined;

  if (isValid && tradeId) {
    try {
      syncedOrder = await syncAlibabaPurchaseOrderByTradeId(tradeId);
    } catch (error) {
      syncError = error instanceof Error ? error.message : "Synchronisation DS impossible.";
    }
  }

  await createAlibabaIntegrationLog({
    action: "aliexpress-webhook",
    endpoint: "/api/admin/aliexpress/webhooks/aliexpress",
    status: isValid && !syncError ? "success" : "failed",
    requestBody: {
      authorizationPresent: Boolean(authorization),
      eventType,
      tradeId,
    },
    responseBody: isRecord(payload)
      ? {
          payload,
          syncedOrderId: syncedOrder?.id,
          syncedPaymentStatus: syncedOrder?.paymentStatus,
          syncError,
        }
      : rawBody,
  });

  if (!isValid) {
    return new Response("invalid signature", { status: 401 });
  }

  return Response.json({ ok: true, eventType, tradeId, synced: Boolean(syncedOrder), syncError }, { status: 200 });
}
