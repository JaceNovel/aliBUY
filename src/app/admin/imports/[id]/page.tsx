import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

import { AdminImportDetailClient } from "@/components/admin-import-detail-client";
import { getAdminImportRequestById } from "@/lib/admin-data";

function statusClass(status: string) {
  if (status === "Complété") {
    return "bg-[#ecfdf3] text-[#027a48]";
  }

  if (status === "En traitement") {
    return "bg-[#eff4ff] text-[#175cd3]";
  }

  if (status === "Rejeté") {
    return "bg-[#fef3f2] text-[#d92d20]";
  }

  return "bg-[#ffefc2] text-[#9a6700]";
}

export default async function AdminImportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const request = await getAdminImportRequestById(id);

  if (!request) {
    notFound();
  }

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-5 rounded-[18px] border border-[#e4e7ec] bg-white px-7 py-6 shadow-[0_2px_10px_rgba(16,24,40,0.04)] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <Link href="/admin/imports" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] border border-[#d0d5dd] text-black transition hover:border-[#e61b4d] hover:text-[#e61b4d]">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-[28px] font-black tracking-[-0.05em] text-black">Détails de la demande #{request.requestCode}</h1>
              <span className={["inline-flex rounded-full px-3 py-1 text-[13px] font-semibold", statusClass(request.status)].join(" ")}>{request.status}</span>
            </div>
          </div>
        </div>
      </section>

      <AdminImportDetailClient request={request} />
    </div>
  );
}