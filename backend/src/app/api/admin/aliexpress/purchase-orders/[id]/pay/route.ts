import { payAlibabaPurchaseOrder, refreshAlibabaPaymentStatus } from "@/lib/alibaba-operations-service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const body = await request.json().catch(() => ({}));
  const { id } = await params;
  const action = body?.action === "refresh" ? "refresh" : "pay";
  const order = action === "refresh"
    ? await refreshAlibabaPaymentStatus(id)
    : await payAlibabaPurchaseOrder(id);

  return Response.json({ order });
}
