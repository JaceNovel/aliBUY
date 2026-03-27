import { notFound } from "next/navigation";

import { AdminSectionContent } from "@/components/admin-section-content";
import { getAdminSectionMeta } from "@/lib/admin-config";
import { getPricingContext } from "@/lib/pricing";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const pricing = await getPricingContext();
  const { section } = await params;
  const meta = getAdminSectionMeta(section as never);

  if (!meta) {
    notFound();
  }

  return <AdminSectionContent slug={section} pricing={pricing} />;
}
