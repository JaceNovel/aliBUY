import Link from "next/link";
import { Globe, Save, Search, ShieldCheck, Store } from "lucide-react";

export default function AdminSiteWebSettingsPage() {
  const blocks = [
    {
      icon: Store,
      title: "Accueil & navigation",
      description: "Met en avant les liens home, catégories, produits et mode du storefront.",
    },
    {
      icon: Search,
      title: "Recherche & suggestions",
      description: "Les suggestions de recherche restent reliées au catalogue et à la page /products.",
    },
    {
      icon: Globe,
      title: "Localisation",
      description: "Devise, pays et contexte prix réutilisent le moteur de pricing du projet.",
    },
    {
      icon: ShieldCheck,
      title: "Fiabilité & conformité",
      description: "Badges, vérifications et messages de confiance affichés sur les pages publiques.",
    },
  ];

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-[28px] font-black tracking-[-0.05em] text-[#101828]">Site Web</h1>
          <p className="mt-1 text-[14px] text-[#667085]">Réglages de structure et de contenu reliés au marketplace public.</p>
        </div>
        <div className="flex gap-3">
          <Link href="/" className="inline-flex h-10 items-center justify-center rounded-[12px] border border-[#e4e7ec] px-4 text-[13px] font-semibold text-[#101828] transition hover:border-[#f84557] hover:text-[#f84557]">
            Voir le site
          </Link>
          <button type="button" className="inline-flex h-10 items-center justify-center gap-2 rounded-[12px] bg-[#f84557] px-4 text-[13px] font-semibold text-white transition hover:bg-[#ea3248]">
            <Save className="h-4 w-4" />
            Enregistrer
          </button>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        {blocks.map((block) => (
          <article key={block.title} className="rounded-[18px] border border-[#e7ebf1] bg-white px-6 py-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
            <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[#fff1f3] text-[#f84557]">
              <block.icon className="h-5 w-5" />
            </div>
            <h2 className="mt-4 text-[18px] font-black text-[#101828]">{block.title}</h2>
            <p className="mt-2 text-[14px] leading-7 text-[#667085]">{block.description}</p>
            <div className="mt-5 flex items-center justify-between rounded-[14px] bg-[#f8fafc] px-4 py-3 text-[13px] text-[#475467]">
              <span>État</span>
              <span className="rounded-full bg-[#dcfae6] px-3 py-1 font-semibold text-[#16a34a]">Actif</span>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}