import Link from "next/link";

import { adminNavItems, adminQuickLinks } from "@/lib/admin-config";

const featuredSections = [
  "orders",
  "products",
  "partner-requests",
  "aliexpress-sourcing",
  "users",
  "settings",
] as const;

export default function AdminPage() {
  const featuredItems = featuredSections
    .map((slug) => adminNavItems.find((item) => item.slug === slug))
    .filter((item): item is (typeof adminNavItems)[number] => Boolean(item));

  return (
    <div className="space-y-6">
      <section className="rounded-[24px] border border-[#e8edf3] bg-[linear-gradient(135deg,#fff5ef_0%,#ffffff_55%,#f6f9fc_100%)] px-6 py-7 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
        <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#ff6a5b]">Admin panel</div>
        <h1 className="mt-2 text-[32px] font-black tracking-[-0.05em] text-[#111827]">Administration Afripay</h1>
        <p className="mt-2 max-w-3xl text-[15px] text-[#5b6472]">
          Point d&apos;entree stable pour acceder rapidement aux sections admin sans charger un tableau de bord lourd.
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          {adminQuickLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full border border-[#d9e1ea] bg-white px-4 py-2 text-[13px] font-semibold text-[#1f2937] transition hover:border-[#ff6a5b] hover:text-[#ff6a5b]"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 text-[18px] font-bold text-[#111827]">Acces rapide</div>
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {featuredItems.map((item) => (
            <Link
              key={item.slug}
              href={item.href}
              className="rounded-[20px] border border-[#e7ecf2] bg-white px-5 py-5 shadow-[0_10px_28px_rgba(15,23,42,0.05)] transition hover:-translate-y-1 hover:border-[#ffd7d2] hover:shadow-[0_18px_36px_rgba(255,106,91,0.12)]"
            >
              <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#ff6a5b]">{item.label}</div>
              <p className="mt-2 text-[15px] leading-6 text-[#4b5563]">{item.description}</p>
              <div className="mt-4 text-[13px] font-semibold text-[#111827]">Ouvrir la section</div>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 text-[18px] font-bold text-[#111827]">Toutes les sections</div>
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {adminNavItems.map((item) => (
            <Link
              key={item.slug}
              href={item.href}
              className="rounded-[18px] border border-[#edf1f5] bg-white px-4 py-4 text-[14px] text-[#334155] transition hover:border-[#ff6a5b] hover:bg-[#fff8f6]"
            >
              <div className="font-semibold text-[#111827]">{item.label}</div>
              <div className="mt-1 text-[13px] leading-5 text-[#667085]">{item.description}</div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
}