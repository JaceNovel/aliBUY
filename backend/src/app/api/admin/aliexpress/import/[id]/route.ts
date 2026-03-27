import { deleteImportedProduct } from "@/lib/alibaba-operations-service";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const result = await deleteImportedProduct(String(id));
    return Response.json(result);
  } catch (error) {
    return Response.json({
      message: error instanceof Error ? error.message : "Suppression de l'article importe impossible.",
    }, { status: 400 });
  }
}
