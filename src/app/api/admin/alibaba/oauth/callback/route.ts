import { exchangeAlibabaOAuthCode } from "@/lib/alibaba-open-platform-client";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const accountId = url.searchParams.get("state") ?? url.searchParams.get("accountId");
  const adminUrl = new URL("/admin/alibaba-sourcing/accounts", url.origin);

  if (!code || !accountId) {
    adminUrl.searchParams.set("oauth", "missing_params");
    return Response.redirect(adminUrl, 302);
  }

  try {
    await exchangeAlibabaOAuthCode({ accountId, code });
    adminUrl.searchParams.set("oauth", "success");
    return Response.redirect(adminUrl, 302);
  } catch (error) {
    adminUrl.searchParams.set("oauth", "failed");
    adminUrl.searchParams.set("message", error instanceof Error ? error.message : "oauth_error");
    return Response.redirect(adminUrl, 302);
  }
}