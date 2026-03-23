import { getAlibabaSupplierAccounts } from "@/lib/alibaba-operations-store";
import { saveAlibabaSupplierAccountInput } from "@/lib/alibaba-operations-service";

export async function GET() {
  const accounts = await getAlibabaSupplierAccounts();
  return Response.json({ accounts });
}

export async function POST(request: Request) {
  const body = await request.json();
  const account = await saveAlibabaSupplierAccountInput({
    id: body?.id ? String(body.id) : undefined,
    name: String(body?.name ?? ""),
    email: String(body?.email ?? ""),
    accountPlatform: body?.accountPlatform === "seller" ? "seller" : body?.accountPlatform === "isv" ? "isv" : "buyer",
    countryCode: String(body?.countryCode ?? "CI"),
    defaultDispatchLocation: String(body?.defaultDispatchLocation ?? "CN"),
    status: body?.status === "connected" ? "connected" : body?.status === "disabled" ? "disabled" : "needs_auth",
    memberId: body?.memberId ? String(body.memberId) : undefined,
    resourceOwner: body?.resourceOwner ? String(body.resourceOwner) : undefined,
    appKey: body?.appKey ? String(body.appKey) : undefined,
    appSecret: body?.appSecret ? String(body.appSecret) : undefined,
    authorizeUrl: body?.authorizeUrl ? String(body.authorizeUrl) : undefined,
    tokenUrl: body?.tokenUrl ? String(body.tokenUrl) : undefined,
    refreshUrl: body?.refreshUrl ? String(body.refreshUrl) : undefined,
    apiBaseUrl: body?.apiBaseUrl ? String(body.apiBaseUrl) : undefined,
    accessToken: body?.accessToken ? String(body.accessToken) : undefined,
    refreshToken: body?.refreshToken ? String(body.refreshToken) : undefined,
    accountId: body?.accountId ? String(body.accountId) : undefined,
    accountLogin: body?.accountLogin ? String(body.accountLogin) : undefined,
    accountName: body?.accountName ? String(body.accountName) : undefined,
    oauthCountry: body?.oauthCountry ? String(body.oauthCountry) : undefined,
    isActive: typeof body?.isActive === "boolean" ? body.isActive : undefined,
    accessTokenHint: body?.accessTokenHint ? String(body.accessTokenHint) : undefined,
  });

  return Response.json({ account });
}
