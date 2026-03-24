import { reenrichImportedProduct } from "@/lib/alibaba-operations-service";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const product = await reenrichImportedProduct(String(id));
    return Response.json({ product });
  } catch (error) {
    return Response.json({
      message: error instanceof Error ? error.message : "Réenrichissement impossible.",
    }, { status: 400 });
  }
}
