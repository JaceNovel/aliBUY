import { CatalogRetiredPage } from "@/components/catalog-retired-page";
import { getPricingContext } from "@/lib/pricing";

export default async function ModePage() {
  const pricing = await getPricingContext();

  return (
    <CatalogRetiredPage
      pricing={pricing}
      label="Mode"
      badge="Mode retiree"
      title="La page mode n'affiche plus de produits"
      description="Les collections mode, promotions et deals visibles au public ont ete supprimes. Les demandes passent maintenant par le devis et le sourcing."
    />
  );
}
