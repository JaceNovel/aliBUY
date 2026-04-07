import { maybeProxyAliExpressAdminRequest } from "@/app/api/admin/aliexpress/proxy";
import { getAlibabaOperationsDashboardData } from "@/lib/alibaba-operations-service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const panel = searchParams.get("panel") ?? undefined;

  const proxiedResponse = await maybeProxyAliExpressAdminRequest({
    request,
    path: "/api/admin/aliexpress/dashboard",
    method: "GET",
    query: panel ? { panel } : undefined,
    fallbackOnResponse: (upstreamResponse) => !upstreamResponse.ok,
  });

  if (proxiedResponse) {
    return proxiedResponse;
  }

  const dashboard = await getAlibabaOperationsDashboardData(panel);
  return Response.json(dashboard);
}
