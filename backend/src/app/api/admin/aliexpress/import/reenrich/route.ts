import { reenrichAllImportedProducts } from "@/lib/alibaba-operations-service";

export async function POST() {
  try {
    const result = await reenrichAllImportedProducts();
    return Response.json(result);
  } catch (error) {
    return Response.json({
      message: error instanceof Error ? error.message : "Réenrichissement global impossible.",
    }, { status: 400 });
  }
}