import { dashboardFetch } from "@/lib/api";
import type { AdminPartnerWithdrawalRecord } from "@/types/partner-dashboard";

export async function getAdminPartnerWithdrawals(): Promise<{ items: AdminPartnerWithdrawalRecord[] }> {
  return dashboardFetch<{ items: AdminPartnerWithdrawalRecord[] }>("/api/admin/partner-withdrawals");
}

export async function updateAdminPartnerWithdrawal(id: string, action: "approve" | "reject", adminNote?: string): Promise<void> {
  await dashboardFetch<{ withdrawal: unknown }>(`/api/admin/partner-withdrawals/${encodeURIComponent(id)}/${action}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ admin_note: adminNote ?? "" }),
  });
}
