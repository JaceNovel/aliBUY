import { NextResponse } from "next/server";

import { SITE_URL } from "@/lib/site-config";

function collectAllowedOrigins(request: Request) {
  const origins = new Set<string>();

  try {
    origins.add(new URL(SITE_URL).origin);
  } catch {
    // Ignore invalid SITE_URL and fall back to request origin only.
  }

  try {
    origins.add(new URL(request.url).origin);
  } catch {
    // Ignore malformed request URL.
  }

  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (forwardedProto && forwardedHost) {
    origins.add(`${forwardedProto}://${forwardedHost}`);
  }

  return origins;
}

function isAllowedFallbackMutationRequest(request: Request, allowedOrigins: Set<string>) {
  const referer = request.headers.get("referer")?.trim();
  if (referer) {
    try {
      if (allowedOrigins.has(new URL(referer).origin)) {
        return true;
      }
    } catch {
      // Ignore malformed referer.
    }
  }

  const fetchSite = request.headers.get("sec-fetch-site")?.trim().toLowerCase();
  return fetchSite === "same-origin" || fetchSite === "same-site" || fetchSite === "none";
}

export function validateMutationOrigin(request: Request, options?: { allowMissingOrigin?: boolean }) {
  const origin = request.headers.get("origin")?.trim();
  const allowedOrigins = collectAllowedOrigins(request);

  if (!origin) {
    if (options?.allowMissingOrigin === true || isAllowedFallbackMutationRequest(request, allowedOrigins)) {
      return null;
    }

    return NextResponse.json({ message: "Origine de requete manquante." }, { status: 403 });
  }

  if (allowedOrigins.has(origin)) {
    return null;
  }

  return NextResponse.json({ message: "Origine de requete non autorisee." }, { status: 403 });
}

export function validateSameSiteDocumentRequest(request: Request) {
  const fetchSite = request.headers.get("sec-fetch-site")?.trim().toLowerCase();
  if (!fetchSite || fetchSite === "same-origin" || fetchSite === "same-site" || fetchSite === "none") {
    return null;
  }

  return NextResponse.json({ message: "Requete documentaire intersite non autorisee." }, { status: 403 });
}