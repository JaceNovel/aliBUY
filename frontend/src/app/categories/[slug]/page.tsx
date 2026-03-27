import type { Metadata } from "next";

import { CatalogRetiredPage } from "@/components/catalog-retired-page";
import { getPricingContext } from "@/lib/pricing";
import { SITE_URL } from "@/lib/site-config";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  return {
    title: "Categorie retiree",
    description: "Les pages categorie publiques ont ete retirees du site.",
    alternates: {
      canonical: `${SITE_URL}/categories/${slug}`,
    },
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const pricing = await getPricingContext();
  const { slug } = await params;

  return (
    <CatalogRetiredPage
      pricing={pricing}
      label={slug}
      badge="Categorie retiree"
      title="Cette categorie n'est plus exposee"
      description="Les pages categorie detaillees et leurs listes de produits ont ete retirees du frontend public. Utilise maintenant le devis ou le sourcing pour continuer."
    />
  );
}
