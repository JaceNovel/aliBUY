import { NextResponse } from "next/server";

import { API_URL, buildApiUrl } from "@/lib/api";
import { getCurrentAdminAccess } from "@/lib/admin-auth";
import { buildServerForwardHeaders } from "@/lib/server-forward-headers";

function buildAdminLoginRedirect(request: Request, message?: string) {
  const requestUrl = new URL(request.url);
  const nextTarget = "/admin/aliexpress-sourcing/accounts";
  const target = new URL("/home_jacen", requestUrl.origin);
  target.searchParams.set("next", nextTarget);
  if (message && message.trim()) {
    target.searchParams.set("oauth_error", message.trim());
  }

  return NextResponse.redirect(target);
}

function buildPayloadFromUrl(request: Request) {
  const url = new URL(request.url);
  return Object.fromEntries(url.searchParams.entries());
}

async function buildPayloadFromRequest(request: Request) {
  const contentType = request.headers.get("content-type")?.toLowerCase() || "";

  if (contentType.includes("application/json")) {
    const payload = await request.json().catch(() => null);
    return payload && typeof payload === "object" && !Array.isArray(payload)
      ? Object.fromEntries(Object.entries(payload).map(([key, value]) => [key, String(value ?? "")]))
      : {};
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return {};
  }

  return Object.fromEntries(Array.from(formData.entries()).map(([key, value]) => [key, String(value)]));
}

async function proxyOauthStart(request: Request) {
  if (!API_URL) {
    return NextResponse.json({ error: true, message: "Backend Laravel non configure pour OAuth AliExpress." }, { status: 503 });
  }

  const adminAccess = await getCurrentAdminAccess().catch(() => null);
  if (!adminAccess) {
    return buildAdminLoginRedirect(request, "Reconnectez-vous avec un compte admin avant de lancer OAuth AliExpress.");
  }

  const payload = request.method === "GET"
    ? buildPayloadFromUrl(request)
    : await buildPayloadFromRequest(request);

  const headers = await buildServerForwardHeaders({
    accept: "application/json",
    "content-type": "application/x-www-form-urlencoded",
  }, {
    includeAdminApiToken: true,
  });

  const response = await fetch(buildApiUrl("/api/admin/aliexpress/supplier-accounts/oauth/start"), {
    method: "POST",
    headers,
    body: new URLSearchParams(payload),
    cache: "no-store",
    redirect: "manual",
  });

  if (response.status === 401) {
    return buildAdminLoginRedirect(request, "La session admin Laravel a expire. Reconnectez-vous puis relancez OAuth AliExpress.");
  }

  const location = response.headers.get("location")?.trim();
  if (location) {
    return NextResponse.redirect(location);
  }

  const payloadBody = await response.json().catch(() => null) as { message?: unknown; redirectUrl?: unknown } | null;
  const redirectUrl = typeof payloadBody?.redirectUrl === "string" ? payloadBody.redirectUrl.trim() : "";
  if (redirectUrl) {
    return NextResponse.redirect(redirectUrl);
  }

  const message = typeof payloadBody?.message === "string" && payloadBody.message.trim().length > 0
    ? payloadBody.message.trim()
    : "Demarrage OAuth AliExpress impossible.";

  return NextResponse.json({ error: true, message }, { status: response.status || 502 });
}

export async function GET(request: Request) {
  return proxyOauthStart(request);
}

export async function POST(request: Request) {
  return proxyOauthStart(request);
}