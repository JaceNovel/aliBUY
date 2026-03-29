import { buildApiUrl } from "@/lib/api";
import { getFreeDealAdminSummary, saveFreeDealConfig, type FreeDealConfig } from "@/lib/free-deal-store";

function parseString(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
}

function parseNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function parseSlugList(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return [...new Set(value.map((entry) => String(entry).trim()).filter(Boolean))];
}

async function maybeProxy(request: Request, path: string, init?: RequestInit) {
  try {
    const upstreamUrl = buildApiUrl(path);
    const currentUrl = new URL(request.url);
    const upstreamHost = new URL(upstreamUrl).host;

    if (upstreamHost && upstreamHost !== currentUrl.host) {
      const upstreamResponse = await fetch(upstreamUrl, {
        cache: "no-store",
        ...init,
      });
      const payload = await upstreamResponse.json().catch(() => null);
      return Response.json(payload, { status: upstreamResponse.status });
    }
  } catch {
    return null;
  }

  return null;
}

export async function GET(request: Request) {
  const proxied = await maybeProxy(request, "/api/admin/free-deals");
  if (proxied) {
    return proxied;
  }

  const summary = await getFreeDealAdminSummary();
  return Response.json(summary);
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => ({})) as Partial<FreeDealConfig>;
  const proxied = await maybeProxy(request, "/api/admin/free-deals", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (proxied) {
    return proxied;
  }

  try {
    const current = await getFreeDealAdminSummary();
    const config = await saveFreeDealConfig({
      enabled: parseBoolean(body.enabled, current.config.enabled),
      pageTitle: parseString(body.pageTitle, current.config.pageTitle),
      heroBadge: parseString(body.heroBadge, current.config.heroBadge),
      heroTitle: parseString(body.heroTitle, current.config.heroTitle),
      heroSubtitle: parseString(body.heroSubtitle, current.config.heroSubtitle),
      bannerText: parseString(body.bannerText, current.config.bannerText),
      ctaLabel: parseString(body.ctaLabel, current.config.ctaLabel),
      shareTitle: parseString(body.shareTitle, current.config.shareTitle),
      shareDescription: parseString(body.shareDescription, current.config.shareDescription),
      itemLimit: parseNumber(body.itemLimit, current.config.itemLimit),
      fixedPriceEur: parseNumber(body.fixedPriceEur, current.config.fixedPriceEur),
      referralGoal: parseNumber(body.referralGoal, current.config.referralGoal),
      dealTagText: parseString(body.dealTagText, current.config.dealTagText),
      productBadgeText: parseString(body.productBadgeText, current.config.productBadgeText),
      compareAtMultiplier: parseNumber(body.compareAtMultiplier, current.config.compareAtMultiplier),
      compareAtExtraEur: parseNumber(body.compareAtExtraEur, current.config.compareAtExtraEur),
      productSlugs: parseSlugList(body.productSlugs, current.config.productSlugs),
    });

    return Response.json({ config });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Impossible d'enregistrer l'offre gratuite.";
    return Response.json({ message }, { status: 400 });
  }
}