import { redirect } from "next/navigation";

import { ALIBABA_PANEL_SLUGS, normalizePanelSlug } from "@/lib/alibaba-operations";

export default async function AdminAliExpressSourcingPanelPage({
  params,
}: {
  params: Promise<{ panel: string }>;
}) {
  const { panel } = await params;
  const normalizedPanel = normalizePanelSlug(panel);

  if (panel !== normalizedPanel || !ALIBABA_PANEL_SLUGS.includes(normalizedPanel)) {
    redirect("/admin/alibaba-sourcing");
  }

  redirect(`/admin/alibaba-sourcing/${normalizedPanel}`);
}
