import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/admin-auth";
import { runAlibabaCatalogImport } from "@/lib/alibaba-operations-service";
import { getFreeDealConfig, saveFreeDealConfig } from "@/lib/free-deal-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ message: "Acces refuse." }, { status: 403 });
  }

  const payload = await request.json().catch(() => null);
  const query = typeof payload?.query === "string" ? payload.query.trim() : "";
  const limit = typeof payload?.limit === "number" ? payload.limit : Number(payload?.limit ?? 12);

  if (!query) {
    return NextResponse.json({ message: "La recherche Alibaba est requise." }, { status: 400 });
  }

  try {
    const result = await runAlibabaCatalogImport({
      query,
      limit: Number.isFinite(limit) ? limit : 12,
      fulfillmentChannel: "crossborder",
      autoPublish: true,
    });

    const currentConfig = await getFreeDealConfig();
    const mergedSlugs = Array.from(new Set([
      ...currentConfig.productSlugs,
      ...result.products.map((product) => product.slug),
    ]));
    const config = await saveFreeDealConfig({
      productSlugs: mergedSlugs,
    });

    return NextResponse.json({
      config,
      products: result.products,
      importedCount: result.products.length,
      targetImportCount: result.targetImportCount,
      warningMessage: result.warningMessage,
      skippedExistingCount: result.skippedExistingCount,
    });
  } catch (error) {
    return NextResponse.json({
      message: error instanceof Error ? error.message : "Import Alibaba impossible pour l'offre gratuite.",
    }, { status: 400 });
  }
}
