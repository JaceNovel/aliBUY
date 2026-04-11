import "server-only";

import { cookies, headers } from "next/headers";

import { BACKEND_ACCESS_TOKEN_COOKIE } from "@/lib/backend-access-token";

const FORWARDED_HEADER_NAMES = [
  "origin",
  "referer",
  "user-agent",
  "x-forwarded-for",
  "x-real-ip",
  "x-forwarded-proto",
  "x-forwarded-host",
  "x-vercel-ip-country",
  "cf-ipcountry",
  "cloudfront-viewer-country",
  "x-country-code",
] as const;

type BuildServerForwardHeadersOptions = {
  includeAdminApiToken?: boolean;
};

export async function buildServerForwardHeaders(
  initialHeaders?: HeadersInit,
  options?: BuildServerForwardHeadersOptions,
) {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  const forwarded = new Headers(initialHeaders);
  const cookieHeader = cookieStore.toString();
  const backendAccessToken = cookieStore.get(BACKEND_ACCESS_TOKEN_COOKIE)?.value?.trim() || "";
  const adminApiToken = options?.includeAdminApiToken
    ? process.env.ADMIN_API_TOKEN?.trim()
    : "";

  if (cookieHeader) {
    forwarded.set("cookie", cookieHeader);
  }

  if (backendAccessToken && !forwarded.has("authorization")) {
    forwarded.set("authorization", backendAccessToken);
  }

  if (backendAccessToken && !forwarded.has("x-admin-token")) {
    forwarded.set("x-admin-token", backendAccessToken);
  }

  if (adminApiToken) {
    forwarded.set("authorization", `Bearer ${adminApiToken}`);
    forwarded.set("x-admin-token", adminApiToken);
  }

  for (const headerName of FORWARDED_HEADER_NAMES) {
    const value = headerStore.get(headerName);
    if (value && !forwarded.has(headerName)) {
      forwarded.set(headerName, value);
    }
  }

  return forwarded;
}