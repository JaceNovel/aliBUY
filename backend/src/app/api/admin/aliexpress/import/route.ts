import { runAlibabaCatalogImport } from "@/lib/alibaba-operations-service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await runAlibabaCatalogImport({
      query: String(body?.query ?? ""),
      limit: Number(body?.limit ?? 12),
      fulfillmentChannel: body?.fulfillmentChannel ?? "crossborder",
      autoPublish: Boolean(body?.autoPublish),
    });

    return Response.json(result);
  } catch (error) {
    return Response.json({
      message: error instanceof Error ? error.message : "Import Alibaba impossible.",
    }, { status: 400 });
  }
}
