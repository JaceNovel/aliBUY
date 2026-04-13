import { AdminSectionContent } from "@/components/admin-section-content";
import { getPricingContext } from "@/lib/pricing";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminProductsPage() {
  const pricing = await getPricingContext();

  return <AdminSectionContent slug="products" pricing={pricing} />;
}
