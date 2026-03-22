import { AdminSectionContent } from "@/components/admin-section-content";
import { getPricingContext } from "@/lib/pricing";

export default async function AdminProductsPage() {
  const pricing = await getPricingContext();

  return <AdminSectionContent slug="products" pricing={pricing} />;
}