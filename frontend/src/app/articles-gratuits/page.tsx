import type { Metadata } from "next";

import { CatalogRetiredPage } from "@/components/catalog-retired-page";
import { getPricingContext } from "@/lib/pricing";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Campagne retiree | AfriPay",
    description: "Les campagnes produit publiques ont ete retirees du site.",
  };
}

export default async function FreeDealPage() {
  const pricing = await getPricingContext();

  return (
    <CatalogRetiredPage
      pricing={pricing}
      label="Articles gratuits"
      badge="Campagne retiree"
      title="Cette campagne produit n'est plus publique"
      description="Les pages de mise en avant produit ont ete retirees du frontend. Le site public se concentre maintenant sur le devis, le sourcing et le back-office."
    />
  );
}
