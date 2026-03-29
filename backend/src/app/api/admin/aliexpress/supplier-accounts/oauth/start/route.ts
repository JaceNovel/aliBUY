import { buildAlibabaAuthorizationUrl } from "@/lib/alibaba-open-platform-client";
import { getAlibabaSupplierAccounts } from "@/lib/alibaba-operations-store";
import { saveAlibabaSupplierAccountInput } from "@/lib/alibaba-operations-service";
import { env } from "@/lib/env";

type OAuthStartPayload = {
  id?: string;
  name?: string;
  email?: string;
  accountPlatform?: string;
  countryCode?: string;
  defaultDispatchLocation?: string;
  memberId?: string;
  resourceOwner?: string;
  appKey?: string;
  appSecret?: string;
  authorizeUrl?: string;
  tokenUrl?: string;
  refreshUrl?: string;
  apiBaseUrl?: string;
  isActive?: boolean;
  accessTokenHint?: string;
  origin?: string;
  responseMode?: string;
};

function buildCorsHeaders(request: Request) {
  const requestOrigin = request.headers.get("origin")?.trim();
  const allowedOrigins = new Set([
    env.frontendOrigin,
    ...env.allowedOrigins,
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ?? "",
  ]);
  const allowOrigin = requestOrigin && allowedOrigins.has(requestOrigin)
    ? requestOrigin
    : env.frontendOrigin;

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, authorization",
    Vary: "Origin",
  };
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: buildCorsHeaders(request),
  });
}

async function readPayload(request: Request): Promise<OAuthStartPayload> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";

  if (contentType.includes("application/json")) {
    return await request.json();
  }

  const formData = await request.formData();

  return {
    id: formData.get("id")?.toString(),
    name: formData.get("name")?.toString(),
    email: formData.get("email")?.toString(),
    accountPlatform: formData.get("accountPlatform")?.toString(),
    countryCode: formData.get("countryCode")?.toString(),
    defaultDispatchLocation: formData.get("defaultDispatchLocation")?.toString(),
    memberId: formData.get("memberId")?.toString(),
    resourceOwner: formData.get("resourceOwner")?.toString(),
    appKey: formData.get("appKey")?.toString(),
    appSecret: formData.get("appSecret")?.toString(),
    authorizeUrl: formData.get("authorizeUrl")?.toString(),
    tokenUrl: formData.get("tokenUrl")?.toString(),
    refreshUrl: formData.get("refreshUrl")?.toString(),
    apiBaseUrl: formData.get("apiBaseUrl")?.toString(),
    isActive: formData.get("isActive")?.toString() === "true",
    accessTokenHint: formData.get("accessTokenHint")?.toString(),
    origin: formData.get("origin")?.toString(),
    responseMode: formData.get("responseMode")?.toString(),
  };
}

export async function POST(request: Request) {
  try {
    const corsHeaders = buildCorsHeaders(request);
    const body = await readPayload(request);
    const url = new URL(request.url);
    const origin = body?.origin ? String(body.origin) : url.origin;
    const configuredRedirectUri = process.env.ALIEXPRESS_SELLER_CALLBACK_URL?.trim();
    const redirectUriUsed = configuredRedirectUri && configuredRedirectUri.length > 0
      ? configuredRedirectUri
      : `${origin}/api/admin/aliexpress/oauth/callback`;
    const existing = body?.id ? (await getAlibabaSupplierAccounts()).find((account) => account.id === String(body.id)) : undefined;
    const account = await saveAlibabaSupplierAccountInput({
      id: body?.id ? String(body.id) : undefined,
      name: String(body?.name ?? existing?.name ?? ""),
      email: String(body?.email ?? existing?.email ?? ""),
      accountPlatform: body?.accountPlatform === "seller" ? "seller" : body?.accountPlatform === "isv" ? "isv" : existing?.accountPlatform ?? "seller",
      countryCode: String(body?.countryCode ?? existing?.countryCode ?? "CI"),
      defaultDispatchLocation: String(body?.defaultDispatchLocation ?? existing?.defaultDispatchLocation ?? "CN"),
      status: "needs_auth",
      memberId: body?.memberId ? String(body.memberId) : existing?.memberId,
      resourceOwner: body?.resourceOwner ? String(body.resourceOwner) : existing?.resourceOwner,
      appKey: body?.appKey ? String(body.appKey) : existing?.appKey,
      appSecret: body?.appSecret ? String(body.appSecret) : existing?.appSecret,
      authorizeUrl: body?.authorizeUrl ? String(body.authorizeUrl) : existing?.authorizeUrl,
      tokenUrl: body?.tokenUrl ? String(body.tokenUrl) : existing?.tokenUrl,
      refreshUrl: body?.refreshUrl ? String(body.refreshUrl) : existing?.refreshUrl,
      apiBaseUrl: body?.apiBaseUrl ? String(body.apiBaseUrl) : existing?.apiBaseUrl,
      isActive: typeof body?.isActive === "boolean" ? body.isActive : true,
      accessTokenHint: body?.accessTokenHint ? String(body.accessTokenHint) : existing?.accessTokenHint,
    });

    const authorizeUrl = await buildAlibabaAuthorizationUrl({
      account,
      redirectUri: redirectUriUsed,
    });

    if (body?.responseMode === "redirect") {
      return Response.redirect(authorizeUrl, 302);
    }

    return Response.json({ account, authorizeUrl, redirectUriUsed }, { headers: corsHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Impossible de generer l'URL d'autorisation AliExpress.";

    console.error("[aliexpress/oauth/start] failed", { message });

    return Response.json({ message }, { status: 400, headers: buildCorsHeaders(request) });
  }
}
