import { NextResponse } from "next/server";

import { API_URL, buildApiUrl } from "@/lib/api";
import { getCurrentUser } from "@/lib/user-auth";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { slug } = await context.params;
  if (!API_URL) {
    return NextResponse.json({ reviews: [], reviewSummary: { totalCount: 0, customerCount: 0, externalCount: 0 } });
  }

  const response = await fetch(buildApiUrl(`/api/products/${encodeURIComponent(slug)}/reviews`), {
    cache: "no-store",
  });
  const body = await response.json().catch(() => null);

  return NextResponse.json(body ?? { reviews: [], reviewSummary: { totalCount: 0, customerCount: 0, externalCount: 0 } }, { status: response.status || 502 });
}

export async function POST(request: Request, context: RouteContext) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) {
    return NextResponse.json({ message: "Connexion requise." }, { status: 401 });
  }

  if (!API_URL) {
    return NextResponse.json({ message: "Le backend avis n'est pas configure sur cet environnement." }, { status: 501 });
  }

  const { slug } = await context.params;
  const payload = await request.json().catch(() => null);
  const response = await fetch(buildApiUrl(`/api/products/${encodeURIComponent(slug)}/reviews`), {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({
      ...(payload && typeof payload === "object" ? payload : {}),
      reviewerName: user.displayName,
      reviewerEmail: user.email,
      reviewerUserId: user.id,
    }),
  });

  const body = await response.json().catch(() => null);
  return NextResponse.json(body ?? { message: "Impossible d'enregistrer l'avis." }, { status: response.status || 502 });
}