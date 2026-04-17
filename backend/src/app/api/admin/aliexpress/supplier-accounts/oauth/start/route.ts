import { NextResponse } from "next/server";
import { getPublicRequestUrl } from "@/lib/public-request-url";

function buildAdminLoginRedirect(request: Request, message?: string) {
  const requestUrl = getPublicRequestUrl(request);
  const nextTarget = "/admin/alibaba-sourcing/accounts";
  const target = new URL("/admin-login", requestUrl.origin);
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
  const payload = request.method === "GET"
    ? buildPayloadFromUrl(request)
    : await buildPayloadFromRequest(request);
  const redirectTarget = new URL("/admin/alibaba-sourcing/accounts", getPublicRequestUrl(request).origin);
  if (payload.name) {
    redirectTarget.searchParams.set("migrated_from", "aliexpress");
  }

  return NextResponse.redirect(redirectTarget);
}

export async function GET(request: Request) {
  return proxyOauthStart(request);
}

export async function POST(request: Request) {
  return proxyOauthStart(request);
}
