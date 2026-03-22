"use client";

import Link from "next/link";
import { ChevronDown, X } from "lucide-react";
import { useMemo, useState } from "react";

import { catalogCategories } from "@/lib/catalog-taxonomy";

type MobileCategoryStripProps = {
  allLabel: string;
};

export function MobileCategoryStrip({ allLabel }: MobileCategoryStripProps) {
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const categoryItems = useMemo(
    () => [
      { label: allLabel, href: "/products" },
      ...catalogCategories.map((category) => ({
        label: category.title,
        href: `/categories/${category.slug}`,
      })),
    ],
    [allLabel],
  );

  return (
    <>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex w-max min-w-full items-center gap-5 pr-2">
            {categoryItems.slice(0, 5).map((item, index) => (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "shrink-0 whitespace-nowrap text-[12px] font-medium text-[#5c5955] transition",
                  index === 0 ? "text-[#111]" : "hover:text-[#111]",
                ].join(" ")}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsPanelOpen(true)}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/70 text-[#222] ring-1 ring-black/8 backdrop-blur-sm"
          aria-label="Ouvrir toutes les categories"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>

      {isPanelOpen ? (
        <div className="fixed inset-0 z-[140] bg-black/28 sm:hidden">
          <div className="absolute inset-x-0 bottom-0 top-[88px] overflow-hidden rounded-t-[26px] bg-white shadow-[0_-20px_60px_rgba(0,0,0,0.18)]">
            <div className="flex items-center justify-between border-b border-[#f0ebe6] px-5 py-4">
              <h2 className="text-[16px] font-semibold text-[#111]">Toutes les catégories</h2>
              <button
                type="button"
                onClick={() => setIsPanelOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#222]"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="h-full overflow-y-auto px-5 pb-10 pt-3">
              <div className="space-y-1">
                {categoryItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsPanelOpen(false)}
                    className="block rounded-[14px] px-3 py-4 text-[15px] text-[#222] transition hover:bg-[#f8f5f2]"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}