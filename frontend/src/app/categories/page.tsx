import type { Metadata } from "next";

import { CatalogRetiredPage } from "@/components/catalog-retired-page";
import { getPricingContext } from "@/lib/pricing";
import { SITE_NAME, SITE_URL } from "@/lib/site-config";

export const metadata: Metadata = {
  title: `Categories retirees | ${SITE_NAME}`,
  description: "Les categories du catalogue public ont ete retirees du site.",
  alternates: {
    canonical: `${SITE_URL}/categories`,
  },
};

export default async function CategoriesPage() {
  const pricing = await getPricingContext();

  return (
    <CatalogRetiredPage
      pricing={pricing}
      label="Categories"
      badge="Categories retirees"
      title="Les categories publiques sont masquees"
      description="Les familles produit et leur taxonomie ne sont plus visibles sur le site public. Le flux actif passe maintenant par le backend sourcing et les demandes de devis."
    />
  );
}
