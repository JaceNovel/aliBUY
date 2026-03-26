import { launchSourcingSupplierPaymentBatch } from "@/lib/sourcing-batch-service";

export async function POST(
  _request: Request,
  context: { params: Promise<{ mode: string }> },
) {
  const { mode } = await context.params;
  if (mode !== "air" && mode !== "sea") {
    return Response.json({ message: "Mode de lot invalide." }, { status: 400 });
  }

  const result = await launchSourcingSupplierPaymentBatch(mode);
  return Response.json(result);
}