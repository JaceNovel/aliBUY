import { maybeProxyAliExpressAdminRequest } from "@/app/api/admin/aliexpress/proxy";
import { payAlibabaPurchaseOrder, refreshAlibabaPaymentStatus, repayAlibabaPurchaseOrder } from "@/lib/alibaba-operations-service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const body = await request.json().catch(() => ({}));
  const { id } = await params;

  const proxiedResponse = await maybeProxyAliExpressAdminRequest({
    request,
    path: `/api/admin/aliexpress/purchase-orders/${id}/pay`,
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  if (proxiedResponse) {
    return proxiedResponse;
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
