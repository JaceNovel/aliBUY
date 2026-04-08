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

function summarizeProxyPayload(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return { message: typeof payload === "string" ? payload : undefined };
  }

  const record = payload as Record<string, unknown>;
  const debug = record.debug && typeof record.debug === "object"
    ? record.debug as Record<string, unknown>
    : undefined;
  const attempts = Array.isArray(debug?.attempts)
    ? debug?.attempts.map((attempt) => {
        if (!attempt || typeof attempt !== "object") {
          return attempt;
        }

        const entry = attempt as Record<string, unknown>;
        return {
          endpoint: entry.endpoint,
          shipToCountry: entry.shipToCountry,
          ok: entry.ok,
          status: entry.status,
          responseShape: entry.responseShape,
          mappingStatus: entry.mappingStatus,
          providerErrorCode: entry.providerErrorCode,
          providerRequestId: entry.providerRequestId,
        };
      })
    : undefined;

  return {
    message: record.message,
    endpoint: record.endpoint,
    sourceProductId: record.sourceProductId,
    providerRequestId: debug?.providerRequestId,
    providerErrorCode: debug?.providerErrorCode,
    providerMessage: debug?.providerMessage,
    responseShape: debug?.responseShape,
    resolvedRemoteMode: debug?.resolvedRemoteMode,
    fallbackUsed: debug?.fallbackUsed,
    attempts,
  };
}

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

    if (!upstreamResponse.ok) {
      try {
        const rawPayload = await upstreamResponse.clone().text();
        let payload: unknown = rawPayload;

        try {
          payload = JSON.parse(rawPayload) as unknown;
        } catch {
          payload = rawPayload;
        }

        console.error("[admin/aliexpress/proxy] upstream error", {
          path: options.path,
          method: options.method ?? options.request.method,
          upstreamUrl,
          status: upstreamResponse.status,
          statusText: upstreamResponse.statusText,
          payload: summarizeProxyPayload(payload),
        });
      } catch {
        console.error("[admin/aliexpress/proxy] upstream error", {
          path: options.path,
          method: options.method ?? options.request.method,
          upstreamUrl,
          status: upstreamResponse.status,
          statusText: upstreamResponse.statusText,
        });
      }
    }

    if (options.fallbackOnResponse?.(upstreamResponse)) {
      options.onFallbackResponse?.(upstreamResponse, { upstreamUrl });
      return null;
    }

    return buildAliExpressProxyResponse(upstreamResponse);
  } catch {
    return null;
  }
}

