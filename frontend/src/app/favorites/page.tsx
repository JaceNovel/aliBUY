import { CatalogRetiredPage } from "@/components/catalog-retired-page";
import { getPricingContext } from "@/lib/pricing";

export default async function FavoritesPage() {
  const pricing = await getPricingContext();

  return (
    <CatalogRetiredPage
      pricing={pricing}
      label="Favoris"
      badge="Favoris retires"
      title="Les favoris produit ne sont plus affiches"
      description="Comme le catalogue public a ete retire, les listes de favoris associees aux produits ne sont plus exposees dans le frontend."
    />
  );
}
