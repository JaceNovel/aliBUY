import { NextResponse } from "next/server";

import { API_URL, buildApiUrl } from "@/lib/api";
import { getCurrentUser } from "@/lib/user-auth";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) {
    return NextResponse.json({ message: "Connexion requise." }, { status: 401 });
  }

  if (!API_URL) {
    return NextResponse.json({ message: "Upload photo indisponible sans backend Laravel." }, { status: 503 });
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ message: "Aucune image transmise." }, { status: 400 });
  }

  const { slug } = await context.params;
  const response = await fetch(buildApiUrl(`/api/products/${encodeURIComponent(slug)}/review-media`), {
    method: "POST",
    headers: {
      accept: "application/json",
    },
    body: formData,
    cache: "no-store",
  });

  const body = await response.json().catch(() => null);
  return NextResponse.json(body ?? { message: "Impossible d'envoyer les photos." }, { status: response.status || 502 });
}