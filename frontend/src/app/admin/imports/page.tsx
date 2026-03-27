import Link from "next/link";
import { Download } from "lucide-react";

import { getAdminImportRequests } from "@/lib/admin-data";

type ImportStatusFilter = "all" | "pending" | "processing" | "completed" | "rejected";

const importStatusTabs: Array<{ label: string; value: ImportStatusFilter; status?: string }> = [
  { label: "Tous", value: "all" },
  { label: "En attente", value: "pending", status: "En attente" },
  { label: "En traitement", value: "processing", status: "En traitement" },
  { label: "Complétés", value: "completed", status: "Complété" },
  { label: "Rejetés", value: "rejected", status: "Rejeté" },
];

function statusClass(status: string) {
  if (status === "Complété") {
    return "bg-[#dcfae6] text-[#16a34a]";
  }

  if (status === "En traitement") {
    return "bg-[#e5edff] text-[#3366ff]";
  }

  if (status === "Rejeté") {
    return "bg-[#fde8e8] text-[#ef4444]";
  }

  return "bg-[#fff4db] text-[#d97706]";
}

export default async function AdminImportsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status = "all" } = await searchParams;
  const activeStatus = importStatusTabs.some((tab) => tab.value === status) ? (status as ImportStatusFilter) : "all";
  const requests = await getAdminImportRequests();
  const visibleRequests = activeStatus === "all"
    ? requests
    : requests.filter((request) => request.status === importStatusTabs.find((tab) => tab.value === activeStatus)?.status);
  const total = requests.length;
  const pending = requests.filter((request) => request.status === "En attente").length;
  const processing = requests.filter((request) => request.status === "En traitement").length;
  const completed = requests.filter((request) => request.status === "Complété").length;

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <h1 className="text-[28px] font-black tracking-[-0.05em] text-[#101828]">Demandes d&apos;Assistance Importation</h1>
        <button type="button" className="inline-flex h-11 items-center justify-center gap-2 rounded-[12px] bg-[#f72b57] px-4 text-[14px] font-semibold text-white transition hover:bg-[#e31f4a]">
          <Download className="h-4 w-4" />
          Exporter
        </button>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total", value: total, color: "text-[#101828]" },
          { label: "En attente", value: pending, color: "text-[#d97706]" },
          { label: "En traitement", value: processing, color: "text-[#3366ff]" },
          { label: "Complétées", value: completed, color: "text-[#16a34a]" },
        ].map((card) => (
          <article key={card.label} className="rounded-[16px] border border-[#e7ebf1] bg-white px-6 py-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
            <div className="text-[14px] font-semibold text-[#101828]">{card.label}</div>
            <div className={`mt-3 text-[18px] font-black ${card.color}`}>{card.value}</div>
          </article>
        ))}
      </section>

      <section className="rounded-[18px] border border-[#e7ebf1] bg-white p-3 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
        <div className="flex flex-wrap gap-2 px-1 pb-3 pt-1 text-[13px] font-medium text-[#667085]">
          {importStatusTabs.map((tab) => (
            <Link key={tab.value} href={tab.value === "all" ? "/admin/imports" : `/admin/imports?status=${tab.value}`} className={[
              "rounded-[10px] px-4 py-2 transition",
              activeStatus === tab.value ? "bg-[#f5f7fb] text-[#101828]" : "hover:bg-[#f5f7fb]",
            ].join(" ")}>
              {tab.label}
            </Link>
          ))}
        </div>

        <div className="overflow-x-auto rounded-[14px] border border-[#edf1f6]">
          <table className="min-w-full text-left">
            <thead className="bg-[#fbfcfe] text-[12px] uppercase tracking-[0.08em] text-[#667085]">
              <tr>
                <th className="px-4 py-3 font-semibold">ID</th>
                <th className="px-4 py-3 font-semibold">Client</th>
                <th className="px-4 py-3 font-semibold">Produit</th>
                <th className="px-4 py-3 font-semibold">Quantité</th>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Statut</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleRequests.map((request) => (
                <tr key={request.orderId} className="border-t border-[#edf1f6] text-[14px] text-[#101828]">
                  <td className="px-4 py-4 font-semibold">{request.orderId.replace("#", "imp-")}</td>
                  <td className="px-4 py-4">
                    <div className="font-semibold">{request.clientName}</div>
                    <div className="text-[13px] text-[#667085]">{request.email}</div>
                  </td>
                  <td className="max-w-[340px] px-4 py-4 text-[#3366ff]">
                    <span className="block truncate">{request.product}</span>
                  </td>
                  <td className="px-4 py-4">{request.quantity}</td>
                  <td className="px-4 py-4 text-[#475467]">
                    <div>{request.dateLabel}</div>
                    <div className="text-[13px]">{request.updatedLabel}</div>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex rounded-full px-3 py-1 text-[12px] font-semibold ${statusClass(request.status)}`}>{request.status}</span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <Link href={request.href} className="inline-flex rounded-[10px] border border-[#e4e7ec] px-4 py-2 text-[14px] font-semibold text-[#101828] transition hover:border-[#f72b57] hover:text-[#f72b57]">
                      Détails
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {visibleRequests.length === 0 ? <div className="px-4 py-6 text-[14px] text-[#667085]">Aucune demande ne correspond à ce filtre.</div> : null}
      </section>
    </div>
  );
}