import "server-only";

import { cookies, headers } from "next/headers";

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

export async function buildServerForwardHeaders(initialHeaders?: HeadersInit) {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  const forwarded = new Headers(initialHeaders);
  const cookieHeader = cookieStore.toString();

  if (cookieHeader) {
    forwarded.set("cookie", cookieHeader);
  }

  for (const headerName of FORWARDED_HEADER_NAMES) {
    const value = headerStore.get(headerName);
    if (value && !forwarded.has(headerName)) {
      forwarded.set(headerName, value);
    }
  }

  return forwarded;
}