import type { ReactNode } from "react";

type TableColumn<T> = {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
};

type TableProps<T> = {
  columns: TableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyTitle?: string;
  emptyDescription?: string;
};

export function Table<T>({
  columns,
  rows,
  rowKey,
  emptyTitle = "Aucune donnée",
  emptyDescription = "Aucun élément à afficher pour le moment.",
}: TableProps<T>) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-6 py-12 text-center">
        <div className="text-base font-semibold text-white">{emptyTitle}</div>
        <div className="mt-2 text-sm text-[#7c8ba1]">{emptyDescription}</div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3 md:hidden">
        {rows.map((row) => (
          <article key={rowKey(row)} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 shadow-[0_18px_40px_rgba(2,6,23,0.28)]">
            {columns.map((column) => (
              <div key={column.key} className="flex items-start justify-between gap-4 border-b border-white/5 py-2 last:border-b-0 last:pb-0 first:pt-0">
                <div className="text-xs uppercase tracking-[0.14em] text-[#64748b]">{column.label}</div>
                <div className="text-right text-sm text-white">{column.render(row)}</div>
              </div>
            ))}
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.03] md:block">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-white/[0.04] text-[#8ea0c0]">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className="px-5 py-4 font-medium">{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={rowKey(row)} className="border-t border-white/8 text-white">
                {columns.map((column) => (
                  <td key={column.key} className="px-5 py-4 align-middle">{column.render(row)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}