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
    <Link href={`/products/${product.slug}`} className="group relative overflow-hidden rounded-[8px] border border-[#eceff3] bg-white shadow-[0_10px_26px_rgba(17,24,39,0.06)] transition duration-500 hover:-translate-y-2 hover:border-[#ff8a3d] hover:shadow-[0_24px_48px_rgba(17,24,39,0.16)]">
      <div className="relative aspect-[0.92] bg-[#f6f7f9]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,182,120,0.28),_transparent_58%),linear-gradient(180deg,transparent_35%,rgba(17,24,39,0.08)_100%)] opacity-0 transition duration-500 group-hover:opacity-100" />
        {badge ? (
          <div className="absolute left-2 top-2 z-10 rounded-[6px] bg-[#111827] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-white shadow-[0_8px_18px_rgba(17,24,39,0.18)] transition duration-500 group-hover:-translate-y-0.5 group-hover:bg-[#ff6a00]">
            {badge}
          </div>
        ) : null}
        <div className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-[6px] bg-white/95 px-2 py-1 text-[10px] font-bold text-[#191919] shadow-[0_8px_18px_rgba(17,24,39,0.12)] transition duration-500 group-hover:translate-y-0.5">
          <Star className="h-3 w-3 fill-[#f7b500] text-[#f7b500]" />
          4.8
        </div>
        <Image
          src={getProductImageUrl(product.image, { width: 480, quality: 76 })}
          alt={product.title}
          fill
          loading="lazy"
          sizes="(min-width: 1536px) 220px, (min-width: 1280px) 200px, (min-width: 768px) 28vw, 46vw"
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.1] group-hover:rotate-[0.6deg]"
        />
      </div>
      <div className="relative p-3 transition duration-500 group-hover:-translate-y-0.5 sm:p-3.5">
        <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#d85300] transition duration-500 group-hover:text-[#ff6a00] sm:text-[10px]">AfriPay Select</div>
        <div className="mt-2 line-clamp-2 min-h-[36px] text-[12px] font-bold leading-4 tracking-[-0.02em] text-[#1f2937] transition duration-500 group-hover:text-[#101828] sm:min-h-[42px] sm:text-[13px] sm:leading-5">{product.title}</div>
        <div className="mt-2.5 flex items-end justify-between gap-2 transition duration-500 group-hover:translate-y-0.5">
          <div>
            <div className="text-[15px] font-black tracking-[-0.04em] text-[#111827] sm:text-[17px]">{formattedPrice}</div>
            <div className="mt-1 text-[10px] text-[#667085] sm:text-[11px]">{product.unit} · suivi AfriPay</div>
          </div>
        </div>
      </div>
    </Link>
  );
}
