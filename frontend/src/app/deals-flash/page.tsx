import { CatalogRetiredPage } from "@/components/catalog-retired-page";
import { getPricingContext } from "@/lib/pricing";

export default async function DealsFlashPage() {
  const pricing = await getPricingContext();

  return (
    <CatalogRetiredPage
      pricing={pricing}
      label="Deals flash"
      badge="Deals retires"
      title="Les deals flash ne sont plus publies"
      description="Les ventes flash, coupons et promotions produits ont ete supprimes du frontend public pour laisser la place a un parcours devis et sourcing."
    />
  );
}
