import { API_URL, buildApiUrl } from "@/lib/api";
import { buildAuthenticatedProxyHeaders } from "@/lib/proxy-auth";

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "content-encoding",
  "content-length",
  "host",
  "keep-alive",
  "transfer-encoding",
]);

function canProxyToUpstream(request: Request, upstreamUrl: string) {
  const currentUrl = new URL(request.url);
  const upstreamHost = new URL(upstreamUrl).host;

  return Boolean(upstreamHost) && upstreamHost !== currentUrl.host;
}

export async function maybeProxyToBackend(request: Request, targetPath?: string) {
  if (!API_URL) {
    return null;
  }

  const currentUrl = new URL(request.url);
  const upstreamUrl = buildApiUrl(targetPath ?? `${currentUrl.pathname}${currentUrl.search}`);
  if (!canProxyToUpstream(request, upstreamUrl)) {
    return null;
  }

  try {
    const contentType = request.headers.get("content-type");
    const accept = request.headers.get("accept");
    const headers = await buildAuthenticatedProxyHeaders(request, {
      ...(contentType ? { "content-type": contentType } : {}),
      ...(accept ? { accept } : {}),
    });

    const body = request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.clone().arrayBuffer();

    const upstreamResponse = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body,
      cache: "no-store",
      redirect: "manual",
    });

    const responseHeaders = new Headers();
    for (const [name, value] of upstreamResponse.headers.entries()) {
      if (!HOP_BY_HOP_HEADERS.has(name.toLowerCase())) {
        responseHeaders.append(name, value);
      }
    }

    const setCookieHeaders = (upstreamResponse.headers as Headers & {
      getSetCookie?: () => string[];
    }).getSetCookie?.();

    if (Array.isArray(setCookieHeaders) && setCookieHeaders.length > 0) {
      responseHeaders.delete("set-cookie");
      for (const cookie of setCookieHeaders) {
        responseHeaders.append("set-cookie", cookie);
      }
    }

    return new Response(await upstreamResponse.arrayBuffer(), {
      status: upstreamResponse.status,
      headers: responseHeaders,
    });
  } catch {
    return null;
  }
}