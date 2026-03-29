import { buildApiUrl } from "@/lib/api";
import { getAlibabaOperationsDashboardData } from "@/lib/alibaba-operations-service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const panel = searchParams.get("panel") ?? undefined;

  try {
    const response = await fetch(buildApiUrl("/api/admin/aliexpress/dashboard", panel ? { panel } : undefined), {
      cache: "no-store",
    });

    if (response.ok) {
      return Response.json(await response.json());
    }
  } catch {
    // Fall back to the local store when the backend API is unreachable.
  }

  const dashboard = await getAlibabaOperationsDashboardData(panel);
  return Response.json(dashboard);
}
