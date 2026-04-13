import Image from "next/image";
import Link from "next/link";
import { Star } from "lucide-react";

import { normalizeStorefrontBadge } from "@/lib/public-storefront";
import type { ProductFeedItem } from "@/lib/products-feed";
import { getProductImageUrl } from "@/lib/product-image";

type ProductCardProps = {
  product: ProductFeedItem;
  formattedPrice: string;
};

export function ProductCard({ product, formattedPrice }: ProductCardProps) {
  const badge = normalizeStorefrontBadge(product.badge);

  return (
    <Link href={`/products/${product.slug}`} className="group overflow-hidden rounded-[8px] border border-[#eceff3] bg-white shadow-[0_10px_26px_rgba(17,24,39,0.06)] transition duration-300 hover:-translate-y-1 hover:border-[#ff8a3d] hover:shadow-[0_18px_40px_rgba(17,24,39,0.13)]">
      <div className="relative aspect-[0.92] bg-[#f6f7f9]">
        {badge ? (
          <div className="absolute left-2 top-2 z-10 rounded-[6px] bg-[#111827] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-white shadow-[0_8px_18px_rgba(17,24,39,0.18)]">
            {badge}
          </div>
        ) : null}
        <div className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-[6px] bg-white/95 px-2 py-1 text-[10px] font-bold text-[#191919] shadow-[0_8px_18px_rgba(17,24,39,0.12)]">
          <Star className="h-3 w-3 fill-[#f7b500] text-[#f7b500]" />
          4.8
        </div>
        <Image
          src={getProductImageUrl(product.image, { width: 480, quality: 76 })}
          alt={product.title}
          fill
          loading="lazy"
          sizes="(min-width: 1536px) 220px, (min-width: 1280px) 200px, (min-width: 768px) 28vw, 46vw"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.06]"
        />
      </div>
      <div className="p-3 sm:p-3.5">
        <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#d85300] sm:text-[10px]">AfriPay Select</div>
        <div className="mt-2 line-clamp-2 min-h-[36px] text-[12px] font-bold leading-4 tracking-[-0.02em] text-[#1f2937] sm:min-h-[42px] sm:text-[13px] sm:leading-5">{product.title}</div>
        <div className="mt-2.5 flex items-end justify-between gap-2">
          <div>
            <div className="text-[15px] font-black tracking-[-0.04em] text-[#111827] sm:text-[17px]">{formattedPrice}</div>
            <div className="mt-1 text-[10px] text-[#667085] sm:text-[11px]">{product.unit} · suivi AfriPay</div>
          </div>
        </div>
      </div>
    </Link>
  );
}
