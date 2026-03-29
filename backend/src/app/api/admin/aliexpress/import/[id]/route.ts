import { deleteImportedProduct } from "@/lib/alibaba-operations-service";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const sourceProductId = new URL(request.url).searchParams.get("sourceProductId") ?? undefined;
    const result = await deleteImportedProduct(String(id), sourceProductId);
    return Response.json(result);
  } catch (error) {
    return Response.json({
      message: error instanceof Error ? error.message : "Suppression de l'article importe impossible.",
    }, { status: 400 });
  }
}
