import Link from "next/link";
import { ArrowUpRight, BriefcaseBusiness, Clapperboard, Dumbbell, House, Music4, Search, Shirt, Sparkles, Tv, Watch } from "lucide-react";

import { getCatalogCategories } from "@/lib/catalog-category-service";

const categoryIcons = [Shirt, Music4, BriefcaseBusiness, Watch, Clapperboard, Tv, House, Dumbbell, Sparkles];

export default async function AdminCategoriesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const query = q.trim().toLowerCase();
  const categories = await getCatalogCategories();
  const rows = categories.filter((category) => {
    if (!query) {
      return true;
    }

    return [category.title, category.slug, category.description, category.sourcePathLabel, ...category.queries].some((value) => value.toLowerCase().includes(query));
  });

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-[28px] font-black tracking-[-0.05em] text-[#101828]">Catégories</h1>
          <p className="mt-1 text-[14px] text-[#667085]">Taxonomie auto-générée depuis les articles Alibaba importés et publiés sur le site.</p>
        </div>
        <div className="rounded-[14px] bg-[#fff1f3] px-4 py-3 text-[13px] font-semibold text-[#f72b57]">
          {rows.length} catégorie{rows.length > 1 ? "s" : ""} synchronisée{rows.length > 1 ? "s" : ""}
        </div>
      </section>

      <section className="rounded-[18px] border border-[#e7ebf1] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
        <form className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98a2b3]" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Rechercher des catégories..."
            className="h-11 w-full rounded-[12px] border border-[#e6eaf0] bg-white pl-11 pr-4 text-[14px] outline-none transition focus:border-[#f72b57]"
          />
        </form>

        <div className="mt-5 overflow-x-auto rounded-[14px] border border-[#edf1f6]">
          <table className="min-w-full text-left">
            <thead className="bg-[#fbfcfe] text-[12px] uppercase tracking-[0.08em] text-[#667085]">
              <tr>
                <th className="px-4 py-3 font-semibold">Image</th>
                <th className="px-4 py-3 font-semibold">Nom</th>
                <th className="px-4 py-3 font-semibold">Slug</th>
                <th className="px-4 py-3 font-semibold">Chemin Alibaba</th>
                <th className="px-4 py-3 font-semibold">Produits</th>
                <th className="px-4 py-3 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((category, index) => {
                const Icon = categoryIcons[index % categoryIcons.length];

                return (
                  <tr key={category.slug} className="border-t border-[#edf1f6] text-[14px] text-[#101828]">
                    <td className="px-4 py-4">
                      {category.image ? (
                        <div
                          className="h-11 w-11 rounded-[14px] border border-[#edf1f6] bg-[#fffaf7] bg-cover bg-center"
                          style={{ backgroundImage: `url(${category.image})` }}
                        />
                      ) : (
                        <div className="flex h-11 w-11 items-center justify-center rounded-[14px] border border-[#edf1f6] bg-[#fffaf7] text-[#1f2937]">
                          <Icon className="h-5 w-5" />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 font-semibold">{category.title}</td>
                    <td className="px-4 py-4 text-[#475467]">{category.slug}</td>
                    <td className="px-4 py-4 text-[#475467]">{category.sourcePathLabel}</td>
                    <td className="px-4 py-4 text-[#475467]">{category.productCount}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/categories/${category.slug}`} className="inline-flex h-9 items-center justify-center gap-2 rounded-[10px] border border-[#e4e7ec] px-3 text-[#101828] transition hover:border-[#f72b57] hover:text-[#f72b57]">
                          Ouvrir
                          <ArrowUpRight className="h-4 w-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}