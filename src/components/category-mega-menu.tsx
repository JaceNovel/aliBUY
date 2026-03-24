"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Diamond,
  Headphones,
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
  const router = useRouter();
  const resolvedTriggerLabel = triggerLabel ?? messages.nav.categories;
  const [activeSlug, setActiveSlug] = useState(categories[0]?.slug ?? "");

  useEffect(() => {
    if (!categories.some((category) => category.slug === activeSlug)) {
      setActiveSlug(categories[0]?.slug ?? "");
    }
  }, [activeSlug, categories]);

  useEffect(() => {
    const active = categories.find((category) => category.slug === activeSlug) ?? categories[0];
    if (!active) {
      return;
    }

    router.prefetch(active.href ?? `/products?category=${encodeURIComponent(active.slug)}`);
    active.products.slice(0, 5).forEach((product) => {
      router.prefetch(`/products/${product.slug}`);
    });
  }, [activeSlug, categories, router]);

  const categoryLinks: CategoryLink[] = categories.slice(0, 9).map((category, index) => ({
    slug: category.slug,
    title: category.title,
    icon: categoryIcons[index % categoryIcons.length],
  }));
  const activeCategory = categories.find((category) => category.slug === activeSlug) ?? categories[0] ?? null;
  const categoryProducts: CategoryProduct[] = activeCategory?.products.slice(0, 5).map((product) => ({
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
        <div className="grid min-h-[470px] grid-cols-[430px_minmax(0,1fr)]">
          <div className="border-r border-[#ececec] bg-white px-4 py-6">
            <div className="max-h-[422px] overflow-y-auto pr-2">
              {categoryLinks.map((item, index) => {
                const Icon = item.icon;

                return (
                  <Link
                    key={item.title}
                    href={categories.find((category) => category.slug === item.slug)?.href ?? `/products?category=${encodeURIComponent(item.slug)}`}
                    onMouseEnter={() => {
                      setActiveSlug(item.slug);
                      router.prefetch(categories.find((category) => category.slug === item.slug)?.href ?? `/products?category=${encodeURIComponent(item.slug)}`);
                    }}
                    onFocus={() => setActiveSlug(item.slug)}
                    className={[
                      "flex items-center gap-4 px-5 py-5 text-[17px] text-[#222] transition-colors hover:bg-[#f8f8f8]",
                      item.slug === activeCategory?.slug ? "border-l-4 border-[#222] bg-[#f4f4f4] font-semibold" : "border-l-4 border-transparent",
                    ].join(" ")}
                  >
                    <Icon className="h-6 w-6 shrink-0 text-[#333]" />
                    <span>{item.title}</span>
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

            <div className="grid grid-cols-5 gap-x-8 gap-y-8">
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
                      ↗
                    </div>
                  </div>
                  <div className="mt-4 line-clamp-2 max-w-[132px] text-[16px] leading-6 text-[#222]">
                    {item.title}
                  </div>
                </Link>
              ))}
            </div>
            {categoryProducts.length === 0 ? <div className="rounded-[18px] bg-[#fafafa] px-4 py-5 text-[14px] text-[#666]">Les catégories se remplissent automatiquement dès qu'un article importé est publié.</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}