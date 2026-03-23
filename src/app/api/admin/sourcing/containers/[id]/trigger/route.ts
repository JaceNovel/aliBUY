import { triggerSeaContainerShipment } from "@/lib/sourcing-service";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const container = await triggerSeaContainerShipment(id);

  return Response.json({ container });
}