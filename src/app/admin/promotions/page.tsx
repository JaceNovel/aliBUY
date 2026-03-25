import { AdminModePromotionsClient } from "@/components/admin-mode-promotions-client";
import { getCatalogProducts } from "@/lib/catalog-service";
import { getModePromotionConfig } from "@/lib/mode-promotions-store";

export default async function AdminPromotionsPage() {
  const [config, products] = await Promise.all([getModePromotionConfig(), getCatalogProducts()]);

  return (
    <AdminModePromotionsClient
      initialConfig={config}
      productOptions={products.map((product) => ({ slug: product.slug, title: product.shortTitle, minUsd: product.minUsd }))}
    />
  );
}