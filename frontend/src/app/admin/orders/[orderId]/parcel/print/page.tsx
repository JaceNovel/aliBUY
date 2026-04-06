import { notFound } from "next/navigation";

import { AdminAutoPrint } from "@/components/admin-auto-print";
import { AdminSourcingDeliveryNote } from "@/components/admin-sourcing-delivery-note";
import { getAdminOrderById, getAdminOrderParcelSnapshot } from "@/lib/admin-data";

export default async function AdminOrderParcelPrintPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const order = await getAdminOrderById(orderId);

  if (!order) {
    notFound();
  }

  const parcelSnapshot = await getAdminOrderParcelSnapshot(order);

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-5 print:max-w-none print:px-0 print:py-0">
      <AdminAutoPrint />
      <AdminSourcingDeliveryNote order={order} parcelSnapshot={parcelSnapshot} />
    </div>
  );
}