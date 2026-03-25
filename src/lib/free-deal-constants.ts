const FREE_DEAL_QUERY_KEYWORDS = [
  "gratuit",
  "gratuits",
  "produit gratuit",
  "produits gratuits",
  "article gratuit",
  "articles gratuits",
] as const;

export const FREE_DEAL_ROUTE = "/articles-gratuits";
export const FREE_DEAL_SHARE_ROUTE_PREFIX = `${FREE_DEAL_ROUTE}/partage`;
export const FREE_DEAL_DEVICE_COOKIE = "afri_free_deal_device";
export const FREE_DEAL_SEARCH_KEYWORDS = [...FREE_DEAL_QUERY_KEYWORDS];

export function normalizeFreeDealText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isFreeDealSearchQuery(value: string) {
  const normalized = normalizeFreeDealText(value);
  return FREE_DEAL_QUERY_KEYWORDS.some((keyword) => normalized === keyword);
}
