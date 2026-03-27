import { createHmac } from "node:crypto";

import { createAlibabaIntegrationLog } from "@/lib/sourcing-store";

function buildSignature(body: string, appKey: string, appSecret: string) {
  return createHmac("sha256", appSecret)
    .update(`${appKey}${body}`, "utf8")
    .digest("hex")
    .toLowerCase();
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const authorization = request.headers.get("authorization")?.toLowerCase() ?? "";
  const appKey = process.env.ALIEXPRESS_DS_WEBHOOK_APP_KEY?.trim() ?? "";
  const appSecret = process.env.ALIEXPRESS_DS_WEBHOOK_SECRET?.trim() ?? "";

  const expectedSignature = appKey && appSecret ? buildSignature(rawBody, appKey, appSecret) : "";
  const isValid = !expectedSignature || authorization === expectedSignature;

  await createAlibabaIntegrationLog({
    action: "aliexpress-webhook",
    endpoint: "/api/admin/aliexpress/webhooks/aliexpress",
    status: isValid ? "success" : "failed",
    requestBody: {
      authorizationPresent: Boolean(authorization),
    },
    responseBody: rawBody,
  });

  if (!isValid) {
    return new Response("invalid signature", { status: 401 });
  }

  return new Response("ok", { status: 200 });
}
