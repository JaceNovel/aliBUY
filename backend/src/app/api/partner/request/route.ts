import { NextResponse } from "next/server";

import { API_URL, buildApiUrl } from "@/lib/api";
import { buildServerForwardHeaders } from "@/lib/server-forward-headers";
import { getCurrentUser } from "@/lib/user-auth";

export async function POST(request: Request) {
  if (!API_URL) {
    return NextResponse.json({ message: "Demande partenaire indisponible sans backend Laravel." }, { status: 503 });
  }

  const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
  const user = await getCurrentUser().catch(() => null);
  const response = await fetch(buildApiUrl("/api/partner/request"), {
    method: "POST",
    headers: await buildServerForwardHeaders({
      accept: "application/json",
      "content-type": "application/json",
    }),
    body: JSON.stringify({
      company_name: typeof payload?.companyName === "string" ? payload.companyName : payload?.company_name,
      website: typeof payload?.website === "string" ? payload.website : null,
      email: user?.email ?? (typeof payload?.email === "string" ? payload.email : null),
      description: typeof payload?.description === "string" ? payload.description : null,
    }),
    cache: "no-store",
  });

  const body = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok && body?.errors && typeof body.errors === "object") {
    const firstError = Object.values(body.errors as Record<string, unknown>).flatMap((entry) => Array.isArray(entry) ? entry : [entry]).find((entry) => typeof entry === "string");
    return NextResponse.json({ ...body, message: typeof firstError === "string" ? firstError : body.message }, { status: response.status || 422 });
  }

  return NextResponse.json(body ?? { message: "Impossible d'envoyer la demande partenaire." }, { status: response.status || 502 });
}