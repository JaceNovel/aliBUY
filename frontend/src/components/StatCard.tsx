import type { LucideIcon } from "lucide-react";

type StatCardProps = {
  title: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  accent?: "indigo" | "green" | "amber";
};

const accentStyles = {
  indigo: "from-[#6366f1]/25 to-[#6366f1]/5 text-[#c7d2fe]",
  green: "from-[#22c55e]/25 to-[#22c55e]/5 text-[#bbf7d0]",
  amber: "from-[#f59e0b]/25 to-[#f59e0b]/5 text-[#fde68a]",
};

export function StatCard({ title, value, detail, icon: Icon, accent = "indigo" }: StatCardProps) {
  return (
    <article className="relative overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(17,24,39,0.9))] p-5 shadow-[0_28px_60px_rgba(2,6,23,0.45)]">
      <div className={`absolute inset-x-0 top-0 h-24 bg-gradient-to-b ${accentStyles[accent]} opacity-80`} />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[#94a3b8]">{title}</p>
          <div className="mt-3 text-[30px] font-black tracking-[-0.05em] text-white">{value}</div>
          <p className="mt-2 text-sm text-[#8ea0c0]">{detail}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/8 text-white ring-1 ring-white/10">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </article>
  );
}