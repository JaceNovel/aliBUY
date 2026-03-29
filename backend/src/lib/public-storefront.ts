export function normalizeStorefrontText(value?: string | null): string {
  if (!value) {
    return "";
  }

  return value
    .trim()
    .replace(/Fiche minimale importee depuis la recherche DS/gi, "Fiche verifiee AfriPay+")
    .replace(/Recherche\s*DS/gi, "Selection AfriPay+")
    .replace(/AliExpress\s*DS/gi, "AfriPay+")
    .replace(/AliExpress/gi, "AfriPay+")
    .replace(/search fallback/gi, "catalogue AfriPay+");
}

export function normalizeStorefrontBadge(value?: string | null): string | undefined {
  const normalized = normalizeStorefrontText(value);
  return normalized || undefined;
}

export function shuffleStorefrontItems<T>(items: readonly T[]): T[] {
  const next = [...items];

  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const current = next[index];
    next[index] = next[swapIndex];
    next[swapIndex] = current;
  }

  return next;
}