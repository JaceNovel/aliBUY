"use client";

import { useEffect, useState } from "react";

import { Table } from "@/components/Table";
import { getOrders } from "@/lib/api";
import type { PartnerOrderRecord, PartnerOrdersResponse } from "@/types/partner-dashboard";

function formatCfa(value: number) {
  return `${new Intl.NumberFormat("fr-FR").format(value)} CFA`;
}

function statusBadge(status: PartnerOrderRecord["status"]) {
  return status === "paid"
    ? "bg-[#22c55e]/15 text-[#86efac] ring-[#22c55e]/25"
    : "bg-[#f59e0b]/15 text-[#fcd34d] ring-[#f59e0b]/25";
}

export default function DashboardOrdersPage() {
  const [orders, setOrders] = useState<PartnerOrdersResponse | null>(null);

  useEffect(() => {
    let alive = true;
    getOrders().then((payload) => {
      if (alive) {
        setOrders(payload);
      }
    }).catch(() => undefined);

    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <section>
        <div className="text-sm uppercase tracking-[0.24em] text-[#818cf8]">Orders</div>
        <h2 className="mt-2 text-[30px] font-black tracking-[-0.05em] text-white">Commandes partenaires</h2>
      </section>

      {!orders ? <div className="h-64 animate-pulse rounded-2xl border border-white/10 bg-white/[0.04]" /> : (
        <>
          <Table
            columns={[
              { key: "id", label: "Order ID", render: (row) => <span className="font-semibold">{row.id}</span> },
              { key: "product", label: "Produit", render: (row) => row.product },
              { key: "price", label: "Prix", render: (row) => formatCfa(row.price) },
              { key: "margin", label: "Marge", render: (row) => <span className="text-[#86efac]">{formatCfa(row.margin)}</span> },
              {
                key: "status",
                label: "Status",
                render: (row) => <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ring-1 ${statusBadge(row.status)}`}>{row.status}</span>,
              },
            ]}
            rows={orders.items}
            rowKey={(row) => row.id}
            emptyTitle="Aucune commande"
            emptyDescription="Les commandes générées via l’API partner apparaîtront ici."
          />

          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-[#8ea0c0]">
            <span>Page {orders.pagination.currentPage} / {orders.pagination.lastPage}</span>
            <span>{orders.pagination.total} commandes</span>
          </div>
        </>
      )}
    </div>
  );
}