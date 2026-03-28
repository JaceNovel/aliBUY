import { buildAlibabaAuthorizationUrl } from "@/lib/alibaba-open-platform-client";
import { getAlibabaSupplierAccounts } from "@/lib/alibaba-operations-store";
import { saveAlibabaSupplierAccountInput } from "@/lib/alibaba-operations-service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const url = new URL(request.url);
    const origin = body?.origin ? String(body.origin) : url.origin;
    const existing = body?.id ? (await getAlibabaSupplierAccounts()).find((account) => account.id === String(body.id)) : undefined;
    const account = await saveAlibabaSupplierAccountInput({
      id: body?.id ? String(body.id) : undefined,
      name: String(body?.name ?? existing?.name ?? ""),
      email: String(body?.email ?? existing?.email ?? ""),
      accountPlatform: body?.accountPlatform === "seller" ? "seller" : body?.accountPlatform === "isv" ? "isv" : existing?.accountPlatform ?? "buyer",
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
      redirectUri: `${origin}/api/admin/aliexpress/oauth/callback`,
    });

    return Response.json({ account, authorizeUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Impossible de generer l'URL d'autorisation AliExpress.";

    console.error("[aliexpress/oauth/start] failed", { message });

    return Response.json({ message }, { status: 400 });
  }
}
