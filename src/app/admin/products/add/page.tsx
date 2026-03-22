import Link from "next/link";
import { FileUp, Plus, Save } from "lucide-react";

import { catalogCategories } from "@/lib/catalog-taxonomy";
import { products } from "@/lib/products-data";
import { getPricingContext } from "@/lib/pricing";

export default async function AdminProductsAddPage() {
  const pricing = await getPricingContext();
  const featuredProducts = products.slice(0, 3);

  return (
    <div className="space-y-5">
      <section className="rounded-[20px] border border-[#e6eaf0] bg-white px-5 py-5 shadow-[0_8px_22px_rgba(17,24,39,0.05)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#ff6a5b]">Administration</div>
            <h1 className="mt-2 text-[30px] font-black tracking-[-0.05em] text-[#1f2937]">Ajouter un produit</h1>
            <p className="mt-2 max-w-[760px] text-[14px] leading-6 text-[#667085]">Preparez une nouvelle fiche catalogue reliee aux categories, au pricing localise et aux pages publiques existantes.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/admin/products" className="inline-flex h-10 items-center justify-center gap-2 rounded-[14px] border border-[#e5e7eb] px-4 text-[13px] font-semibold text-[#1f2937] transition hover:border-[#ff6a5b] hover:text-[#ff6a5b]">
              Voir la liste
            </Link>
            <button type="button" className="inline-flex h-10 items-center justify-center gap-2 rounded-[14px] bg-[#ff5b4d] px-4 text-[13px] font-semibold text-white transition hover:bg-[#f04438]">
              <Save className="h-4 w-4" />
              Enregistrer le brouillon
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-[20px] border border-[#e6eaf0] bg-white px-5 py-5 shadow-[0_8px_22px_rgba(17,24,39,0.05)]">
          <div className="text-[18px] font-bold text-[#1f2937]">Fiche produit</div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-[13px] font-semibold text-[#344054]">
              <span>Nom du produit</span>
              <input className="h-11 w-full rounded-[14px] border border-[#dde2ea] px-4 text-[14px] outline-none focus:border-[#ff6a5b]" defaultValue="Nouveau produit AfriPay" />
            </label>
            <label className="space-y-2 text-[13px] font-semibold text-[#344054]">
              <span>Slug</span>
              <input className="h-11 w-full rounded-[14px] border border-[#dde2ea] px-4 text-[14px] outline-none focus:border-[#ff6a5b]" defaultValue="nouveau-produit-afripay" />
            </label>
            <label className="space-y-2 text-[13px] font-semibold text-[#344054]">
              <span>Prix minimum</span>
              <input className="h-11 w-full rounded-[14px] border border-[#dde2ea] px-4 text-[14px] outline-none focus:border-[#ff6a5b]" defaultValue={pricing.formatPrice(12.5)} />
            </label>
            <label className="space-y-2 text-[13px] font-semibold text-[#344054]">
              <span>MOQ</span>
              <input className="h-11 w-full rounded-[14px] border border-[#dde2ea] px-4 text-[14px] outline-none focus:border-[#ff6a5b]" defaultValue="100 pièces" />
            </label>
            <label className="space-y-2 text-[13px] font-semibold text-[#344054] md:col-span-2">
              <span>Categorie</span>
              <select className="h-11 w-full rounded-[14px] border border-[#dde2ea] px-4 text-[14px] outline-none focus:border-[#ff6a5b]">
                {catalogCategories.map((category) => (
                  <option key={category.slug} value={category.slug}>{category.title}</option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-[13px] font-semibold text-[#344054] md:col-span-2">
              <span>Description</span>
              <textarea className="min-h-[160px] w-full rounded-[14px] border border-[#dde2ea] px-4 py-3 text-[14px] outline-none focus:border-[#ff6a5b]" defaultValue="Produit pret pour integration dans le catalogue AfriPay avec badge, prix localise, variations et route detail." />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" className="inline-flex h-10 items-center justify-center gap-2 rounded-[14px] border border-dashed border-[#cfd6e1] bg-[#fafafa] px-4 text-[13px] font-semibold text-[#344054] transition hover:border-[#ff6a5b] hover:text-[#ff6a5b]">
              <FileUp className="h-4 w-4" />
              Ajouter des medias
            </button>
            <button type="button" className="inline-flex h-10 items-center justify-center gap-2 rounded-[14px] border border-dashed border-[#cfd6e1] bg-[#fafafa] px-4 text-[13px] font-semibold text-[#344054] transition hover:border-[#ff6a5b] hover:text-[#ff6a5b]">
              <Plus className="h-4 w-4" />
              Ajouter des variantes
            </button>
          </div>
        </article>

        <aside className="space-y-4">
          <article className="rounded-[20px] border border-[#e6eaf0] bg-white px-5 py-5 shadow-[0_8px_22px_rgba(17,24,39,0.05)]">
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#ff6a5b]">Contexte actif</div>
            <div className="mt-2 text-[20px] font-black text-[#1f2937]">Pricing localise</div>
            <div className="mt-3 rounded-[14px] bg-[#f8f9fb] px-4 py-4 text-[13px] leading-6 text-[#667085]">
              Tous les apercus admin restent relies a la devise {pricing.currency.code}, au pays {pricing.countryLabel} et aux routes publiques du projet.
            </div>
          </article>

          <article className="rounded-[20px] border border-[#e6eaf0] bg-white px-5 py-5 shadow-[0_8px_22px_rgba(17,24,39,0.05)]">
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#ff6a5b]">Exemples existants</div>
            <div className="mt-4 space-y-3">
              {featuredProducts.map((product) => (
                <Link key={product.slug} href={`/products/${product.slug}`} className="block rounded-[14px] bg-[#f8f9fb] px-4 py-3 transition hover:bg-[#fff2ed]">
                  <div className="text-[13px] font-bold text-[#1f2937]">{product.shortTitle}</div>
                  <div className="mt-1 text-[12px] text-[#667085]">{product.supplierName}</div>
                </Link>
              ))}
            </div>
          </article>
        </aside>
      </section>
    </div>
  );
}