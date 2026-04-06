import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { getCurrentAdminAccess, isAdminAuthenticated } from "@/lib/admin-auth";
import { getAdminOrderById, getAdminOrderParcelSnapshot } from "@/lib/admin-data";
import { getDeliveryNoteDocumentNumber, getDeliveryNoteExportHistory } from "@/lib/admin-sourcing-delivery-note-data";
import { generateAdminSourcingDeliveryNotePdf } from "@/lib/admin-sourcing-delivery-note-pdf";
import { getSourcingOrderMeta, withSourcingOrderMeta } from "@/lib/alibaba-sourcing";
import { validateSameSiteDocumentRequest } from "@/lib/request-security";
import { getSourcingOrderById, saveSourcingOrder } from "@/lib/sourcing-store";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const documentRequestError = validateSameSiteDocumentRequest(request);
  if (documentRequestError) {
    return documentRequestError;
  }

  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ message: "Acces refuse." }, { status: 403 });
  }

  const { id } = await params;
  const order = await getAdminOrderById(id);

  if (!order) {
    return NextResponse.json({ message: "Commande sourcing introuvable." }, { status: 404 });
  }

  const parcelSnapshot = await getAdminOrderParcelSnapshot(order);
  const pdfBuffer = await generateAdminSourcingDeliveryNotePdf(order, parcelSnapshot);
  const disposition: "inline" | "attachment" = new URL(request.url).searchParams.get("disposition") === "inline" ? "inline" : "attachment";
  const documentNumber = getDeliveryNoteDocumentNumber(order);
  const persistedOrder = await getSourcingOrderById(id).catch(() => null);

  if (persistedOrder) {
    const access = await getCurrentAdminAccess().catch(() => null);
    const currentMeta = getSourcingOrderMeta(persistedOrder);
    const nextOrder = withSourcingOrderMeta(persistedOrder, {
      ...currentMeta,
      deliveryNoteExports: [
        {
          id: randomUUID(),
          documentNumber,
          disposition,
          exportedAt: new Date().toISOString(),
          exportedByEmail: access?.email,
        },
        ...getDeliveryNoteExportHistory(persistedOrder),
      ].slice(0, 30),
    });

    await saveSourcingOrder({
      ...nextOrder,
      updatedAt: new Date().toISOString(),
    }).catch(() => null);
  }

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `${disposition}; filename="${documentNumber}-${order.orderNumber}-bon-sourcing.pdf"`,
      "cache-control": "no-store",
    },
  });
}