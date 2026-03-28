import { CatalogRetiredPage } from "@/components/catalog-retired-page";
import { getPricingContext } from "@/lib/pricing";

export default async function TrendsPage() {
  const pricing = await getPricingContext();

  return (
    <CatalogRetiredPage
      pricing={pricing}
      label="Tendances"
      badge="Tendances retirees"
      title="Les tendances publiques ne sont plus affichees"
      description="Les promotions, selections en stock et recommandations ne sont plus visibles publiquement. Les demandes passent maintenant par le devis et l'accompagnement AfriPay."
    />
  );
}
