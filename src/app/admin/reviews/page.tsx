import { Eye, EyeOff, MessageSquareWarning, RefreshCw, Search, SlidersHorizontal, Star } from "lucide-react";

import { getAdminReviews } from "@/lib/admin-data";

export default function AdminReviewsPage() {
  const reviews = getAdminReviews();
  const total = reviews.length;
  const published = reviews.filter((review) => review.status === "Publié").length;
  const hidden = reviews.filter((review) => review.status === "Masqué").length;
  const needsResponse = reviews.filter((review) => review.responseStatus === "Réponse attendue").length;
  const average = (reviews.reduce((sum, review) => sum + review.score, 0) / total).toFixed(1);
  const distribution = [5, 4, 3, 2, 1].map((score) => ({ score, count: reviews.filter((review) => review.score === score).length }));

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <h1 className="text-[28px] font-black tracking-[-0.05em] text-[#101828]">Gestion des Avis Clients</h1>
        <button type="button" className="inline-flex h-11 items-center justify-center gap-2 rounded-[12px] border border-[#e4e7ec] bg-white px-4 text-[14px] font-semibold text-[#101828] transition hover:border-[#f5c842]">
          <RefreshCw className="h-4 w-4" />
          Actualiser
        </button>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total des avis", value: total, detail: `Note moyenne: ${average}`, icon: Star, tone: "text-[#101828]" },
          { label: "Avis publiés", value: published, detail: `${Math.round((published / total) * 100)}% du total`, icon: Eye, tone: "text-[#16a34a]" },
          { label: "Avis masqués", value: hidden, detail: `${Math.round((hidden / total) * 100)}% du total`, icon: EyeOff, tone: "text-[#ef4444]" },
          { label: "Nécessitent une réponse", value: needsResponse, detail: "Principalement des avis négatifs", icon: MessageSquareWarning, tone: "text-[#f97316]" },
        ].map((card) => (
          <article key={card.label} className="rounded-[16px] border border-[#e7ebf1] bg-white px-6 py-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
            <div className="text-[14px] text-[#667085]">{card.label}</div>
            <div className="mt-3 flex items-center gap-3">
              <card.icon className={`h-5 w-5 ${card.tone}`} />
              <div className="text-[18px] font-black text-[#101828]">{card.value}</div>
            </div>
            <div className="mt-2 text-[13px] text-[#667085]">{card.detail}</div>
          </article>
        ))}
      </section>

      <section className="rounded-[18px] border border-[#e7ebf1] bg-white px-6 py-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
        <h2 className="text-[18px] font-black text-[#101828]">Distribution des notes</h2>
        <div className="mt-5 space-y-4">
          {distribution.map((item) => (
            <div key={item.score} className="grid grid-cols-[40px_1fr_24px] items-center gap-3 text-[14px] text-[#667085]">
              <div className="font-semibold text-[#101828]">{item.score}★</div>
              <div className="h-3 rounded-full bg-[#e5e7eb]">
                <div className="h-3 rounded-full bg-[#ffcc1a]" style={{ width: `${(item.count / total) * 100}%` }} />
              </div>
              <div className="text-right">{item.count}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[18px] border border-[#e7ebf1] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2 text-[13px] font-medium text-[#667085]">
            {[
              "Tous",
              "Publiés",
              "Masqués",
              "En attente",
            ].map((tab, index) => (
              <button key={tab} type="button" className={["rounded-[10px] px-4 py-2 transition", index === 0 ? "bg-[#f5f7fb] text-[#101828]" : "hover:bg-[#f5f7fb]"] .join(" ")}>
                {tab}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98a2b3]" />
              <input placeholder="Rechercher..." className="h-11 rounded-[12px] border border-[#e4e7ec] pl-11 pr-4 text-[14px] outline-none focus:border-[#f5c842]" />
            </div>
            <button type="button" className="inline-flex h-11 w-11 items-center justify-center rounded-[12px] border border-[#e4e7ec] text-[#101828] transition hover:border-[#f5c842]">
              <SlidersHorizontal className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {[
            "Toutes les notes",
            "Tous les avis",
            "Tous les achats",
          ].map((label, index) => (
            <select key={`${label}-${index}`} className="h-11 rounded-[12px] border border-[#e4e7ec] px-4 text-[14px] outline-none focus:border-[#f5c842]">
              <option>{label}</option>
            </select>
          ))}
        </div>

        <div className="mt-5 overflow-x-auto rounded-[14px] border border-[#edf1f6]">
          <table className="min-w-full text-left">
            <thead className="bg-[#fbfcfe] text-[12px] uppercase tracking-[0.08em] text-[#667085]">
              <tr>
                <th className="px-4 py-3 font-semibold">Client</th>
                <th className="px-4 py-3 font-semibold">Produit</th>
                <th className="px-4 py-3 font-semibold">Note</th>
                <th className="px-4 py-3 font-semibold">Statut</th>
                <th className="px-4 py-3 font-semibold">Réponse</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((review) => (
                <tr key={`${review.reviewer}-${review.product}`} className="border-t border-[#edf1f6] text-[14px] text-[#101828]">
                  <td className="px-4 py-4 font-semibold">{review.reviewer}</td>
                  <td className="px-4 py-4">{review.product}</td>
                  <td className="px-4 py-4">{review.score}/5</td>
                  <td className="px-4 py-4">{review.status}</td>
                  <td className="px-4 py-4">{review.responseStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}