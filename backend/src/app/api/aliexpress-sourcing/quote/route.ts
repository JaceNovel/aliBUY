import { NextResponse } from "next/server";

import { createAlibabaSourcingQuote } from "@/lib/alibaba-sourcing-server";
import { getSourcingSettings } from "@/lib/sourcing-store";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const items = Array.isArray(body?.items) ? body.items : [];
    const disableFreeAir = body?.disableFreeAir === true;
    const deliveryMode = body?.deliveryMode === "forwarder" ? "forwarder" : "direct";
    const settings = await getSourcingSettings();
    const quote = await createAlibabaSourcingQuote(items, settings, {
      disableFreeAir,
      deliveryMode,
    });

    return NextResponse.json({
      ...quote,
      settings,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Impossible de calculer le devis AliExpress.",
      },
      { status: 500 },
    );
  }
}