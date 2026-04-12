import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site-config";

const STATIC_ROUTES = [
  "",
  "/products",
  "/categories",
  "/trends",
  "/mode",
  "/deals-flash",
  "/pricing",
  "/quotes",
  "/application",
  "/protection-commandes",
  "/decouvrir-afripay",
  "/articles-gratuits",
  "/docs",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return STATIC_ROUTES.map((path) => {
    const changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] = path === "" ? "daily" : "weekly";

    return {
      url: `${SITE_URL}${path}`,
      changeFrequency,
      priority: path === "" ? 1 : 0.7,
    };
  });
}
