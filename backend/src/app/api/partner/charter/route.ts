import { buildApiUrl } from "@/lib/api";
import { fetchPartnerPortalResponse, getCurrentPartnerPortalIdentity } from "@/lib/partner-portal";

export async function GET() {
  const email = await getCurrentPartnerPortalIdentity();
  if (!email) {
    return Response.json({ message: "Connexion requise." }, { status: 401 });
  }

  const upstreamResponse = await fetchPartnerPortalResponse("/api/partner/portal/charter", email);
  if (!upstreamResponse.ok) {
    const payload = await upstreamResponse.json().catch(() => null);
    const message = payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string"
      ? payload.message
      : "Impossible de récupérer la charte partenaire.";
    return Response.json({ message }, { status: upstreamResponse.status });
  }

  const responseHeaders = new Headers();
  responseHeaders.set("Content-Type", upstreamResponse.headers.get("content-type") || "application/pdf");
  responseHeaders.set(
    "Content-Disposition",
    upstreamResponse.headers.get("content-disposition") || 'attachment; filename="afripay-charte-partenaire.pdf"',
  );
  responseHeaders.set("Cache-Control", "private, no-store, max-age=0");
  responseHeaders.set("X-Source-Url", buildApiUrl("/api/partner/portal/charter"));

  return new Response(await upstreamResponse.arrayBuffer(), {
    status: 200,
    headers: responseHeaders,
  });
}