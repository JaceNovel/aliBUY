import { triggerSeaContainerShipment } from "@/lib/sourcing-service";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const container = await triggerSeaContainerShipment(id);

    return Response.json({ container });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Impossible de declencher ce conteneur.";
    return Response.json({ message }, { status: 400 });
  }
}