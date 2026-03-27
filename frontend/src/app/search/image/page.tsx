import { CatalogRetiredPage } from "@/components/catalog-retired-page";
import { getPricingContext } from "@/lib/pricing";

export default async function ImageSearchPage({
  searchParams: _searchParams,
}: {
  searchParams: Promise<{ slugs?: string; name?: string }>;
}) {
  const pricing = await getPricingContext();

  return (
    <CatalogRetiredPage
      pricing={pricing}
      label="Recherche par image"
      badge="Recherche retiree"
      title="La recherche visuelle produit n'est plus disponible"
      description="La recherche par image et ses correspondances catalogue ont ete retirees du frontend public avec les autres fiches produit."
      primaryHref="/quotes"
      primaryLabel="Envoyer une demande"
    />
  );
}
