import { CatalogRetiredPage } from "@/components/catalog-retired-page";
import { getPricingContext } from "@/lib/pricing";

export default async function TrendsPage() {
  const pricing = await getPricingContext();

  return (
    <CatalogRetiredPage
      pricing={pricing}
      label="Tendances"
      badge="Tendances retirees"
      title="Les tendances publiques ont ete retirees"
      description="Les produits en stock, promotions et recommandations visibles sur le site ne sont plus exposes. Le parcours public passe desormais par le sourcing."
    />
  );
}
