import { NextResponse } from "next/server";

import { API_URL } from "@/lib/api";
import { getCurrentAdminAccess } from "@/lib/admin-auth";
import { exportAdminSourcingDeliveryNote } from "@/lib/admin-sourcing-order-actions";
import { getAdminOrderById, getAdminOrderParcelSnapshot } from "@/lib/admin-data";
import { getDeliveryNoteDocumentNumber } from "@/lib/admin-sourcing-delivery-note-data";
import { generateAdminSourcingDeliveryNotePdf } from "@/lib/admin-sourcing-delivery-note-pdf";
import { buildServerForwardHeaders } from "@/lib/server-forward-headers";

type RouteContext = {
  params: Promise<{ orderId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const adminAccess = await getCurrentAdminAccess().catch(() => null);
  if (!adminAccess) {
    return NextResponse.json({ message: "Connexion admin requise." }, { status: 401 });
  }

  const { orderId } = await context.params;
  const requestUrl = new URL(request.url);
  const disposition = requestUrl.searchParams.get("download") === "1" ? "attachment" : "inline";

  if (API_URL) {
    const registerResponse = await fetch(`${API_URL}/api/admin/sourcing/orders/${encodeURIComponent(orderId)}/delivery-note`, {
      method: "POST",
      headers: await buildServerForwardHeaders({
        accept: request.headers.get("accept")?.trim() || "application/json",
        "content-type": "application/json",
      }, {
        includeAdminApiToken: true,
      }),
      body: JSON.stringify({ disposition }),
      cache: "no-store",
    }).catch(() => null);

    if (registerResponse?.ok) {
      const order = await getAdminOrderById(orderId);
      if (!order) {
        return NextResponse.json({ message: "Commande sourcing introuvable." }, { status: 404 });
      }

      const parcelSnapshot = await getAdminOrderParcelSnapshot(order);
      const filename = `${getDeliveryNoteDocumentNumber(order)}.pdf`;
      const pdfBody = new Uint8Array(await generateAdminSourcingDeliveryNotePdf(order, parcelSnapshot));

      return new NextResponse(pdfBody, {
        status: 200,
        headers: {
          "content-type": "application/pdf",
          "content-disposition": `${disposition}; filename="${filename}"`,
          "cache-control": "no-store",
        },
      });
    }
  }

  try {
    const result = await exportAdminSourcingDeliveryNote(orderId, disposition, adminAccess.email);
    const filename = `${result.documentNumber}.pdf`;
    const pdfBody = new Uint8Array(result.pdf);

    return new NextResponse(pdfBody, {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `${disposition}; filename=\"${filename}\"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json({
      message: error instanceof Error ? error.message : "Impossible de generer le bon imprimable.",
    }, { status: 422 });
  }
}