import { notFound } from "next/navigation";

import { AdminSectionContent } from "@/components/admin-section-content";
import { adminNavItems, getAdminSectionMeta } from "@/lib/admin-data";
import { getPricingContext } from "@/lib/pricing";

export function generateStaticParams() {
  return adminNavItems.map((item) => ({ section: item.slug }));
}

export default async function AdminSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const pricing = await getPricingContext();
  const { section } = await params;
  const meta = getAdminSectionMeta(section as never);

  if (!meta) {
    notFound();
  }

  return <AdminSectionContent slug={section} pricing={pricing} />;
}