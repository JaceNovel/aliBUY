function getConfiguredSiteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://afripay.space";
}

function isLocalHostname(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0";
}

export function getPublicRequestUrl(request: Request) {
  const requestUrl = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host")?.trim() || request.headers.get("host")?.trim() || "";
  const forwardedProto = request.headers.get("x-forwarded-proto")?.trim() || requestUrl.protocol.replace(":", "") || "https";

  if (forwardedHost) {
    return new URL(`${forwardedProto}://${forwardedHost}${requestUrl.pathname}${requestUrl.search}`);
  }

  if (process.env.NODE_ENV === "production" && isLocalHostname(requestUrl.hostname)) {
    try {
      const siteUrl = new URL(getConfiguredSiteUrl());
      siteUrl.pathname = requestUrl.pathname;
      siteUrl.search = requestUrl.search;
      return siteUrl;
    } catch {
      return requestUrl;
    }
  }

  return requestUrl;
}
