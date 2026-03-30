import { buildApiUrl } from "@/lib/api";
import { deleteImportedProduct } from "@/lib/alibaba-operations-service";

function buildProxyHeaders(request: Request) {
  const headers = new Headers();

  for (const headerName of ["cookie", "authorization", "user-agent", "x-forwarded-for", "x-real-ip", "x-forwarded-proto", "x-forwarded-host"]) {
    const value = request.headers.get(headerName);
    if (value) {
      headers.set(headerName, value);
    }
  }

  return headers;
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const sourceProductId = new URL(request.url).searchParams.get("sourceProductId") ?? undefined;

    try {
      const upstreamUrl = buildApiUrl(`/api/admin/aliexpress/import/${encodeURIComponent(String(id))}`, sourceProductId ? { sourceProductId } : undefined);
      const currentUrl = new URL(request.url);
      const upstreamHost = new URL(upstreamUrl).host;

      if (upstreamHost && upstreamHost !== currentUrl.host) {
        const upstreamResponse = await fetch(upstreamUrl, {
          method: "DELETE",
          headers: buildProxyHeaders(request),
          cache: "no-store",
        });

        if (upstreamResponse.status === 403 || upstreamResponse.status === 404 || upstreamResponse.status >= 500) {
          console.warn("[admin/aliexpress/import/:id] upstream unavailable, fallback to local handler", {
            upstreamUrl,
            status: upstreamResponse.status,
          });
          throw new Error("fallback-to-local");
        }

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
    } catch {
      // Fall back to the local store when the upstream backend is unreachable.
    }

    const result = await deleteImportedProduct(String(id), sourceProductId);
    return Response.json(result);
  } catch (error) {
    return Response.json({
      message: error instanceof Error ? error.message : "Suppression de l'article importe impossible.",
    }, { status: 400 });
  }
}
