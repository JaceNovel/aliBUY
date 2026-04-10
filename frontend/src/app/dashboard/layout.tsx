import { PartnerDashboardShell } from "@/components/partner-dashboard-shell";
import { requireApprovedPartnerPortalAccess } from "@/lib/partner-portal";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const access = await requireApprovedPartnerPortalAccess();
  if (!access?.partner) {
    notFound();
  }

  return <PartnerDashboardShell companyName={access.partner.companyName}>{children}</PartnerDashboardShell>;
}