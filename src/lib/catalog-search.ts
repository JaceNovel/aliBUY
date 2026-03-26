import "server-only";

import { getCatalogProducts } from "@/lib/catalog-service";
import { FREE_DEAL_SEARCH_KEYWORDS } from "@/lib/free-deal-constants";

const defaultSearchSuggestions = [
  "souris sans fil",
  "bureau gaming",
  "casque VR",
  "bean bag gaming",
  "piercing titane",
  "accessoires mobile",
  ...FREE_DEAL_SEARCH_KEYWORDS,
];

export async function getCatalogSearchSuggestions(query: string, limit = 8) {
  const products = await getCatalogProducts();
  const suggestions = Array.from(
    new Set(
      [
        ...defaultSearchSuggestions,
        ...products.flatMap((product) => [product.shortTitle, ...(product.keywords ?? [])]),
      ].map((entry) => entry.trim()).filter(Boolean),
    ),
  );

  const normalizedQuery = query.trim().toLowerCase();
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
