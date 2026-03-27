import Image from "next/image";
import Link from "next/link";

import type { ProductFeedItem } from "@/lib/products-feed";
import { getProductImageUrl } from "@/lib/product-image";

type ProductCardProps = {
  product: ProductFeedItem;
  formattedPrice: string;
};

export function ProductCard({ product, formattedPrice }: ProductCardProps) {
  return (
    <Link href={`/products/${product.slug}`} className="group overflow-hidden rounded-[16px] bg-white ring-1 ring-black/5 transition hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(17,24,39,0.12)] sm:rounded-[18px]">
      <div className="relative aspect-[0.95] bg-[#f5f5f5]">
        {product.badge ? (
          <div className="absolute left-2 top-2 z-10 rounded-full bg-[#de0505] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-white">
            {product.badge}
          </div>
        ) : null}
        <Image
          src={getProductImageUrl(product.image, { width: 480, quality: 76 })}
          alt={product.title}
          fill
          loading="lazy"
          sizes="(min-width: 1536px) 220px, (min-width: 1280px) 200px, (min-width: 768px) 28vw, 46vw"
          className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
      </div>
      <div className="p-2.5 sm:p-3">
        <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#d04a0a] sm:text-[10px] sm:tracking-[0.14em]">AfriPay Guaranteed</div>
        <div className="mt-1.5 line-clamp-2 min-h-[34px] text-[12px] font-semibold leading-4 text-[#222] sm:mt-2 sm:min-h-[40px] sm:text-[13px] sm:leading-5">{product.title}</div>
        <div className="mt-2 text-[14px] font-bold tracking-[-0.03em] text-[#f05a00] sm:text-[16px]">{formattedPrice}</div>
        <div className="mt-1 text-[10px] text-[#666] sm:text-[12px]">MOQ: {product.moq} {product.unit}</div>
      </div>
    </Link>
  );
}