import { NextResponse } from "next/server";

import { API_URL } from "@/lib/api";
import { getCurrentAdminAccess } from "@/lib/admin-auth";
import { buildServerForwardHeaders } from "@/lib/server-forward-headers";

export async function GET(request: Request) {
  if (!API_URL) {
    return NextResponse.json({ message: "Backend Laravel non configure pour les retraits partenaire." }, { status: 503 });
  }

  const adminAccess = await getCurrentAdminAccess().catch(() => null);
  if (!adminAccess) {
    return NextResponse.json({ message: "Connexion admin requise." }, { status: 401 });
  }

  const response = await fetch(`${API_URL}/api/admin/partner-withdrawals`, {
    method: request.method,
    headers: await buildServerForwardHeaders({
      accept: request.headers.get("accept")?.trim() || "application/json",
    }, {
      includeAdminApiToken: true,
    }),
    cache: "no-store",
  });

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