"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowUpRight,
  Diamond,
  Headphones,
  Home,
  Menu,
  PencilRuler,
  Shirt,
  Sofa,
  Sparkles,
  Sprout,
  Star,
  Volleyball,
  Wheat,
  type LucideIcon,
} from "lucide-react";
import { getMessages } from "@/lib/messages";

export type CategoryMegaMenuCategory = {
  slug: string;
  title: string;
  href?: string;
  products: Array<{
    slug: string;
    shortTitle: string;
    image: string;
  }>;
};

type CategoryMegaMenuProps = {
  triggerLabel?: string;
  showMenuIcon?: boolean;
  triggerClassName?: string;
  panelClassName?: string;
  widthClassName?: string;
  languageCode?: string;
  categories?: CategoryMegaMenuCategory[];
};

type CategoryLink = {
  slug: string;
  title: string;
  icon: LucideIcon;
};

type CategoryProduct = {
  slug: string;
  title: string;
  image: string;
};

const categoryIcons: LucideIcon[] = [Star, Headphones, Diamond, PencilRuler, Wheat, Shirt, Sofa, Volleyball, Sprout];

function resolveCategoryIcon(slug: string, title: string) {
  const haystack = `${slug} ${title}`.toLowerCase();

  if (/(bijou|jewel|ring|watch|accessor)/.test(haystack)) {
    return Diamond;
  }

  if (/(phone|telephone|mobile|tablet|audio|headphone|ecouteur)/.test(haystack)) {
    return Headphones;
  }

  if (/(maison|home|garden|jardin|kitchen|decor|decoration)/.test(haystack)) {
    return Home;
  }

  if (/(meuble|bureau|sofa|chair|table|desk|cabinet)/.test(haystack)) {
    return Sofa;
  }

  if (/(mode|fashion|shirt|vetement|chaussure|sac)/.test(haystack)) {
    return Shirt;
  }

  if (/(jardin|garden|plante|nature)/.test(haystack)) {
    return Sprout;
  }

  if (/(sport|fitness|gaming|loisir)/.test(haystack)) {
    return Volleyball;
  }

  if (/(outil|outilage|design|bureau d'etude|ruler)/.test(haystack)) {
    return PencilRuler;
  }

  if (/(aliment|epicerie|cuisine|grain|food)/.test(haystack)) {
    return Wheat;
  }

  return categoryIcons[Math.abs(slug.length + title.length) % categoryIcons.length] ?? Star;
}

function isDisplayableCategory(category: CategoryMegaMenuCategory) {
  return !/^(usd|cny|eur|gbp|cad|aud|xof|fcfa)$/i.test(category.title.trim());
}

export function CategoryMegaMenu({
  triggerLabel,
  showMenuIcon = true,
  triggerClassName = "inline-flex h-full items-center gap-3 border-b-2 border-transparent pr-2 hover:border-[#222]",
  panelClassName = "top-full",
  widthClassName = "w-[1360px]",
  languageCode,
  categories = [],
}: CategoryMegaMenuProps) {
  const messages = getMessages(languageCode);
  const resolvedTriggerLabel = triggerLabel ?? messages.nav.categories;
  const displayCategories = categories.filter(isDisplayableCategory);
  const [activeSlug, setActiveSlug] = useState(displayCategories[0]?.slug ?? "");
  const activeCategory = displayCategories.find((category) => category.slug === activeSlug) ?? displayCategories[0] ?? null;

  const categoryLinks: CategoryLink[] = displayCategories.slice(0, 9).map((category) => ({
    slug: category.slug,
    title: category.title,
    icon: resolveCategoryIcon(category.slug, category.title),
  }));
  const categoryProducts: CategoryProduct[] = activeCategory?.products.slice(0, 8).map((product) => ({
    slug: product.slug,
    title: product.shortTitle,
    image: product.image,
  })) ?? [];

  return (
    <div className="group relative">
      <span className={triggerClassName}>
        {showMenuIcon ? <Menu className="h-4 w-4" /> : null}
        {resolvedTriggerLabel}
      </span>

      <div
        className={[
          "invisible absolute left-0 z-[120] overflow-hidden rounded-b-[10px] border border-[#e5e5e5] bg-white opacity-0 shadow-[0_22px_45px_rgba(0,0,0,0.12)] transition-all duration-200 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100",
          "-translate-y-1",
          panelClassName,
          widthClassName,
        ].join(" ")}
      >
        <div className="grid min-h-[470px] grid-cols-[minmax(320px,380px)_minmax(0,1fr)] 2xl:grid-cols-[430px_minmax(0,1fr)]">
          <div className="border-r border-[#ececec] bg-white px-4 py-6">
            <div className="max-h-[422px] overflow-y-auto pr-2">
              {categoryLinks.map((item) => {
                const Icon = item.icon;

                return (
                  <Link
                    key={item.title}
                    href={displayCategories.find((category) => category.slug === item.slug)?.href ?? `/products?category=${encodeURIComponent(item.slug)}`}
                    onMouseEnter={() => {
                      setActiveSlug(item.slug);
                    }}
                    onFocus={() => setActiveSlug(item.slug)}
                    className={[
                      "flex items-center gap-4 px-5 py-5 text-[17px] text-[#222] transition-colors hover:bg-[#f8f8f8]",
                      item.slug === activeCategory?.slug ? "border-l-4 border-[#222] bg-[#f4f4f4] font-semibold" : "border-l-4 border-transparent",
                    ].join(" ")}
                  >
                    <Icon className="h-6 w-6 shrink-0 text-[#333]" />
                    <span className="line-clamp-2">{item.title}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="bg-white px-8 py-6">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-[22px] font-semibold tracking-[-0.03em] text-[#222]">{activeCategory?.title ?? messages.categoryMenu.forYou}</h3>
              <Sparkles className="h-5 w-5 text-[#888]" />
            </div>

            <div className="grid grid-cols-4 gap-x-6 gap-y-8 2xl:grid-cols-5 2xl:gap-x-8">
              {categoryProducts.map((item) => (
                <Link key={item.slug} href={`/products/${item.slug}`} className="group/item flex flex-col items-center text-center">
                  <div className="relative h-[126px] w-[126px] overflow-hidden rounded-full bg-[#f6f6f6]">
                    <Image
                      src={item.image}
                      alt={item.title}
                      fill
                      sizes="126px"
                      className="object-contain p-3 transition-transform duration-200 group-hover/item:scale-105"
                    />
                    <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#1a73e8] text-white">
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </div>
                  </div>
                  <div className="mt-4 line-clamp-2 max-w-[132px] text-[16px] leading-6 text-[#222]">
                    {item.title}
                  </div>
                </Link>
              ))}
            </div>
            {categoryProducts.length === 0 ? <div className="rounded-[18px] bg-[#fafafa] px-4 py-5 text-[14px] text-[#666]">Les catégories se remplissent automatiquement dès qu&apos;un article importé est publié.</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
