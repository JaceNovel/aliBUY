import { ChevronDown, Plus } from "lucide-react";

import { getCatalogCategories } from "@/lib/catalog-category-service";
import { getAlibabaImportedProducts } from "@/lib/alibaba-operations-store";

export default async function AdminOffersAddPage() {
  const [selectedProducts, categories] = await Promise.all([
    getAlibabaImportedProducts().then((products) => products.filter((product) => product.publishedToSite).slice(0, 3)),
    getCatalogCategories(),
  ]);

  return (
    <div className="space-y-5">
      <section>
        <h1 className="text-[28px] font-black tracking-[-0.05em] text-[#101828]">Ajouter une offre groupée</h1>
        <p className="mt-1 text-[14px] text-[#667085]">Créez une nouvelle offre groupée en sélectionnant les produits et en définissant la réduction.</p>
      </section>

      <section className="rounded-[18px] border border-[#e7ebf1] bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
        <div className="grid gap-5">
          <label className="space-y-2 text-[13px] font-semibold text-[#101828]">
            <span>Titre de l&apos;offre</span>
            <input defaultValue="Pack Beauté Premium" className="h-11 w-full rounded-[12px] border border-[#dfe3ea] px-4 text-[14px] outline-none focus:border-[#f84557]" />
          </label>

          <label className="space-y-2 text-[13px] font-semibold text-[#101828]">
            <span>Réduction</span>
            <input defaultValue="25%" className="h-11 w-full rounded-[12px] border border-[#dfe3ea] px-4 text-[14px] outline-none focus:border-[#f84557]" />
          </label>

          <label className="space-y-2 border-b border-[#edf1f6] pb-5 text-[13px] font-semibold text-[#101828]">
            <span>Catégorie</span>
            <div className="flex h-11 items-center justify-between rounded-[12px] border border-[#dfe3ea] px-4 text-[14px] text-[#101828]">
              <span>{categories[0]?.title ?? "Aucune catégorie publiée"}</span>
              <ChevronDown className="h-4 w-4 text-[#98a2b3]" />
            </div>
          </label>

          <label className="space-y-2 text-[13px] font-semibold text-[#101828]">
            <span>Ajouter des produits</span>
            <div className="flex h-11 items-center justify-between rounded-[12px] border border-[#dfe3ea] px-4 text-[14px] text-[#101828]">
              <span>Sélectionner un produit</span>
              <ChevronDown className="h-4 w-4 text-[#98a2b3]" />
            </div>
          </label>

          <div>
            <div className="text-[13px] font-semibold text-[#101828]">Produits sélectionnés</div>
            <div className="mt-3 space-y-2">
              {selectedProducts.length > 0 ? selectedProducts.map((product) => (
                <div key={product.slug} className="rounded-[12px] bg-[#f8fafc] px-4 py-3 text-[13px] text-[#475467]">
                  {product.shortTitle}
                </div>
              )) : <div className="rounded-[12px] bg-[#fff7ed] px-4 py-3 text-[13px] text-[#9a3412]">Aucun produit importe/publie disponible. Lance un import AliExpress avant de creer une offre.</div>}
            </div>
          </div>

          <div className="flex justify-end">
            <button type="button" className="inline-flex h-11 items-center justify-center gap-2 rounded-[12px] bg-[#f84557] px-5 text-[14px] font-semibold text-white shadow-[0_10px_18px_rgba(248,69,87,0.18)] transition hover:bg-[#ea3248]">
              <Plus className="h-4 w-4" />
              Créer l&apos;offre groupée
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}