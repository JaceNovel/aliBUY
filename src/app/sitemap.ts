import type { MetadataRoute } from "next";

import { getCatalogCategories } from "@/lib/catalog-category-service";
import { getCatalogProducts } from "@/lib/catalog-service";
import { SITE_URL } from "@/lib/site-config";

const STATIC_ROUTES = [
  "",
  "/products",
  "/categories",
  "/pricing",
  "/trends",
  "/mode",
  "/quotes",
  "/support-center",
  "/protection-commandes",
  "/decouvrir-afripay",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories] = await Promise.all([
    getCatalogProducts(),
    getCatalogCategories(),
  ]);

  return [
    ...STATIC_ROUTES.map((path) => {
      const changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] = path === "" ? "daily" : "weekly";

      return {
      url: `${SITE_URL}${path}`,
      changeFrequency,
      priority: path === "" ? 1 : 0.7,
      };
    }),
    ...categories.map((category) => ({
      url: `${SITE_URL}/categories/${category.slug}`,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    ...products.map((product) => ({
      url: `${SITE_URL}/products/${product.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
