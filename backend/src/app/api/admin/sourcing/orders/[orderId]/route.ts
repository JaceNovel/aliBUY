import { NextResponse } from "next/server";

import { API_URL } from "@/lib/api";
import { getCurrentAdminAccess } from "@/lib/admin-auth";
import { updateAdminSourcingOrder } from "@/lib/admin-sourcing-order-actions";
import { buildServerForwardHeaders } from "@/lib/server-forward-headers";

type RouteContext = {
  params: Promise<{ orderId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const adminAccess = await getCurrentAdminAccess().catch(() => null);
  if (!adminAccess) {
    return NextResponse.json({ message: "Connexion admin requise." }, { status: 401 });
  }

  const { orderId } = await context.params;
  const payload = await request.json().catch(() => null);

  if (API_URL) {
    const response = await fetch(`${API_URL}/api/admin/sourcing/orders/${encodeURIComponent(orderId)}`, {
      method: "PATCH",
      headers: await buildServerForwardHeaders({
        accept: request.headers.get("accept")?.trim() || "application/json",
        "content-type": "application/json",
      }, {
        includeAdminApiToken: true,
      }),
      body: JSON.stringify(payload ?? {}),
      cache: "no-store",
    }).catch(() => null);

    if (response) {
      const responseHeaders = new Headers();
      const responseContentType = response.headers.get("content-type");
      if (responseContentType) {
        responseHeaders.set("content-type", responseContentType);
      }

      return new NextResponse(response.body, {
        status: response.status,
        headers: responseHeaders,
      });
    }
  }

  try {
    const result = await updateAdminSourcingOrder(orderId, payload);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({
      message: error instanceof Error ? error.message : "Impossible de mettre a jour cette commande sourcing.",
    }, { status: 422 });
  }
}