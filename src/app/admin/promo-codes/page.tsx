import { AdminPromoCodesClient } from "@/components/admin-promo-codes-client";
import { getPromoCodes } from "@/lib/promo-codes-store";

export default async function AdminPromoCodesPage() {
  const promoCodes = await getPromoCodes();
  return <AdminPromoCodesClient initialPromoCodes={promoCodes} />;
}