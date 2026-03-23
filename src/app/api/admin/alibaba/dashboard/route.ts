import { getAlibabaOperationsDashboardData } from "@/lib/alibaba-operations-service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const panel = searchParams.get("panel") ?? undefined;
  const dashboard = await getAlibabaOperationsDashboardData(panel);
  return Response.json(dashboard);
}
