import { API_URL, buildApiUrl } from "@/lib/api";
import { payAlibabaPurchaseOrder, refreshAlibabaPaymentStatus, repayAlibabaPurchaseOrder } from "@/lib/alibaba-operations-service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const body = await request.json().catch(() => ({}));
  const { id } = await params;

  try {
    if (!API_URL) {
      throw new Error("Local admin AliExpress execution.");
    }

    const upstreamUrl = buildApiUrl(`/api/admin/aliexpress/purchase-orders/${id}/pay`);
    const currentUrl = new URL(request.url);
    const upstreamHost = new URL(upstreamUrl).host;

    if (upstreamHost && upstreamHost !== currentUrl.host) {
      const upstreamResponse = await fetch(upstreamUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(request.headers.get("cookie") ? { cookie: request.headers.get("cookie") ?? "" } : {}),
        },
        body: JSON.stringify(body),
        cache: "no-store",
      });

      const payload = await upstreamResponse.json().catch(() => null);
      return Response.json(payload, { status: upstreamResponse.status });
    }
  } catch {
    // Fall back to the local store when the upstream backend is unreachable.
  }

  const action = body?.action === "refresh"
    ? "refresh"
    : body?.action === "repay"
      ? "repay"
      : "pay";
  const order = action === "refresh"
    ? await refreshAlibabaPaymentStatus(id)
    : action === "repay"
      ? await repayAlibabaPurchaseOrder(id)
      : await payAlibabaPurchaseOrder(id);

  return Response.json({ order });
}
