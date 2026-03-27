import "server-only";

import { Prisma } from "@prisma/client";

import { getCatalogProducts } from "@/lib/catalog-service";
import { FREE_DEAL_SEARCH_KEYWORDS } from "@/lib/free-deal-constants";
import { prisma } from "@/lib/prisma";
import { withRedisJsonCache } from "@/lib/redis-cache";

const defaultSearchSuggestions = [
  "souris sans fil",
  "bureau gaming",
  "casque VR",
  "bean bag gaming",
  "piercing titane",
  "accessoires mobile",
  ...FREE_DEAL_SEARCH_KEYWORDS,
];

const SEARCH_SUGGESTIONS_TTL_SECONDS = 90;

function normalizeQuery(query: string) {
  return query.trim().toLowerCase();
}

async function getDatabaseSearchSuggestions(query: string, limit: number) {
  const likeQuery = `%${query}%`;
  const rows = await prisma.$queryRaw<Array<{ suggestion: string }>>(Prisma.sql`
    SELECT
      suggestion
    FROM (
      SELECT
        "shortTitle" AS suggestion,
        GREATEST(
          similarity("title", ${query}),
          similarity("shortTitle", ${query})
        ) AS rank
      FROM "AlibabaImportedProductRecord"
      WHERE "publishedToSite" = true
        AND "status" = 'published'
        AND (
          "title" % ${query}
          OR "shortTitle" % ${query}
          OR "title" ILIKE ${likeQuery}
          OR "shortTitle" ILIKE ${likeQuery}
        )

      UNION ALL

      SELECT
        "title" AS suggestion,
        GREATEST(
          similarity("title", ${query}),
          similarity("shortTitle", ${query})
        ) AS rank
      FROM "AlibabaImportedProductRecord"
      WHERE "publishedToSite" = true
        AND "status" = 'published'
        AND (
          "title" % ${query}
          OR "shortTitle" % ${query}
          OR "title" ILIKE ${likeQuery}
          OR "shortTitle" ILIKE ${likeQuery}
        )
    ) suggestions
    WHERE suggestion IS NOT NULL
      AND suggestion <> ''
    GROUP BY suggestion
    ORDER BY MAX(rank) DESC, suggestion ASC
    LIMIT ${limit}
  `);

  return rows.map((row) => row.suggestion.trim()).filter(Boolean);
}

export async function getCatalogSearchSuggestions(query: string, limit = 8) {
  const normalizedQuery = normalizeQuery(query);

  if (!normalizedQuery) {
    return defaultSearchSuggestions.slice(0, limit);
  }

  if (process.env.DATABASE_URL) {
    return withRedisJsonCache(
      `search:suggestions:${normalizedQuery}:${limit}`,
      SEARCH_SUGGESTIONS_TTL_SECONDS,
      async () => {
        try {
          const suggestions = await getDatabaseSearchSuggestions(normalizedQuery, limit);
          if (suggestions.length > 0) {
            return suggestions;
          }
        } catch (error) {
          console.warn("[catalog-search] database suggestions fallback", {
            message: error instanceof Error ? error.message : "Unknown error",
            query: normalizedQuery,
          });
        }

        return getFallbackSearchSuggestions(normalizedQuery, limit);
      },
    );
  }

  return getFallbackSearchSuggestions(normalizedQuery, limit);
}

async function getFallbackSearchSuggestions(normalizedQuery: string, limit: number) {
  const products = await getCatalogProducts();
  const suggestions = Array.from(
    new Set(
      [
        ...defaultSearchSuggestions,
        ...products.flatMap((product) => [product.shortTitle, ...(product.keywords ?? [])]),
      ].map((entry) => entry.trim()).filter(Boolean),
    ),
  );

  const rankedSuggestions = suggestions
    .map((suggestion) => {
      const normalizedSuggestion = suggestion.toLowerCase();

      if (!normalizedQuery) {
        return { suggestion, score: 0 };
      }

      if (!normalizedSuggestion.includes(normalizedQuery)) {
        return null;
      }

      let score = 0;
      if (normalizedSuggestion === normalizedQuery) score += 12;
      if (normalizedSuggestion.startsWith(normalizedQuery)) score += 8;
      if (normalizedSuggestion.includes(` ${normalizedQuery}`)) score += 5;

      return { suggestion, score };
    })
    .filter((entry): entry is { suggestion: string; score: number } => entry !== null)
    .sort((left, right) => right.score - left.score || left.suggestion.localeCompare(right.suggestion));

  return rankedSuggestions.slice(0, limit).map((entry) => entry.suggestion);
}
