import { NextResponse } from "next/server";

import { createSharedCart } from "@/lib/cart-share-store";
import { getCatalogProductsBySlugs } from "@/lib/catalog-service";
import { SITE_NAME, SITE_URL } from "@/lib/site-config";
import { getCurrentUser } from "@/lib/user-auth";

type ShareCartRequestBody = {
  items?: Array<{
    slug?: string;
    quantity?: number;
    selectedVariants?: Record<string, string>;
  }>;
  message?: string;
};

function normalizeItems(value: ShareCartRequestBody["items"]) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    const slug = typeof item?.slug === "string" ? item.slug.trim() : "";
    const quantity = Number(item?.quantity ?? 0);
    const selectedVariants = item?.selectedVariants && typeof item.selectedVariants === "object"
      ? Object.fromEntries(
          Object.entries(item.selectedVariants)
            .filter(([label, selectedValue]) => label.trim() && typeof selectedValue === "string" && selectedValue.trim())
            .map(([label, selectedValue]) => [label.trim(), selectedValue.trim()]),
        )
      : undefined;

    if (!slug || !Number.isFinite(quantity) || quantity <= 0) {
      return [];
    }

    return [{
      slug,
      quantity,
      selectedVariants: selectedVariants && Object.keys(selectedVariants).length > 0 ? selectedVariants : undefined,
    }];
  });
}

function normalizeMessage(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 280) : undefined;
}

export async function POST(request: Request) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) {
    return NextResponse.json({ message: "Connexion requise." }, { status: 401 });
  }

  const payload = await request.json().catch(() => null) as ShareCartRequestBody | null;
  const items = normalizeItems(payload?.items);
  if (items.length === 0) {
    return NextResponse.json({ message: "Aucun article valide a partager." }, { status: 400 });
  }

  const sharedCart = await createSharedCart({
    ownerUserId: user.id,
    ownerEmail: user.email,
    ownerDisplayName: user.displayName,
    message: normalizeMessage(payload?.message),
    items,
  });

  const products = await getCatalogProductsBySlugs([...new Set(items.map((item) => item.slug))], { fresh: true }).catch(() => []);
  const titleMap = new Map(products.map((product) => [product.slug, product.shortTitle || product.title] as const));
  const itemSummary = items
    .slice(0, 3)
    .map((item) => `${titleMap.get(item.slug) ?? item.slug} x${item.quantity}`)
    .join(", ");
  const shareUrl = `${SITE_URL.replace(/\/$/, "")}/cart/shared/${encodeURIComponent(sharedCart.token)}`;
  const shareText = sharedCart.message?.trim()
    || `${user.displayName} a partage ${items.length} article${items.length > 1 ? "s" : ""} sur ${SITE_NAME}${itemSummary ? `: ${itemSummary}` : ""}.`;

  return NextResponse.json({
    ok: true,
    token: sharedCart.token,
    shareUrl,
    shareText,
    copyText: `${shareText}\n${shareUrl}`,
  });
}