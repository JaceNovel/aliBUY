import { API_URL, buildApiUrl } from "@/lib/api";

type ProxyQuery = Record<string, string | number | boolean | null | undefined>;

type MaybeProxyAliExpressAdminRequestOptions = {
  request: Request;
  path: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  query?: ProxyQuery;
  body?: BodyInit | null;
  headers?: HeadersInit;
  fallbackOnResponse?: (response: Response) => boolean;
  onFallbackResponse?: (response: Response, context: { upstreamUrl: string }) => void;
};

export function buildAliExpressProxyHeaders(request: Request, extras?: HeadersInit) {
  const headers = new Headers(extras);

  for (const headerName of ["cookie", "authorization", "user-agent", "x-forwarded-for", "x-real-ip", "x-forwarded-proto", "x-forwarded-host"]) {
    const value = request.headers.get(headerName);
    if (value) {
      headers.set(headerName, value);
    }
  }

  return headers;
}

export async function buildAliExpressProxyResponse(upstreamResponse: Response) {
  const rawPayload = await upstreamResponse.text();
  if (!rawPayload.trim()) {
    return Response.json({ ok: upstreamResponse.ok }, { status: upstreamResponse.status });
  }

  try {
    const payload = JSON.parse(rawPayload) as unknown;
    return Response.json(payload, { status: upstreamResponse.status });
  } catch {
    return Response.json({ message: rawPayload }, { status: upstreamResponse.status });
  }
}

export async function maybeProxyAliExpressAdminRequest(options: MaybeProxyAliExpressAdminRequestOptions) {
  if (!API_URL) {
    return null;
  }

  try {
    const upstreamUrl = buildApiUrl(options.path, options.query);
    const currentUrl = new URL(options.request.url);
    const upstreamHost = new URL(upstreamUrl).host;

    if (!upstreamHost || upstreamHost === currentUrl.host) {
      return null;
    }

    const upstreamResponse = await fetch(upstreamUrl, {
      method: options.method,
      headers: buildAliExpressProxyHeaders(options.request, options.headers),
      body: options.body,
      cache: "no-store",
    });

    if (options.fallbackOnResponse?.(upstreamResponse)) {
      options.onFallbackResponse?.(upstreamResponse, { upstreamUrl });
      return null;
    }

    return buildAliExpressProxyResponse(upstreamResponse);
  } catch {
    return null;
  }
}

