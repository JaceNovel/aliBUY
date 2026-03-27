type ProductGridSkeletonProps = {
  count?: number;
};

export function ProductGridSkeleton({ count = 8 }: ProductGridSkeletonProps) {
  return (
    <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {Array.from({ length: count }).map((_, index) => (
        <div key={`product-skeleton-${index}`} className="overflow-hidden rounded-[16px] bg-white ring-1 ring-black/5 sm:rounded-[18px]">
          <div className="aspect-[0.95] animate-pulse bg-[#f0f2f5]" />
          <div className="space-y-2 p-2.5 sm:p-3">
            <div className="h-2.5 w-24 animate-pulse rounded-full bg-[#f0f2f5]" />
            <div className="h-4 w-full animate-pulse rounded-full bg-[#f0f2f5]" />
            <div className="h-4 w-5/6 animate-pulse rounded-full bg-[#f0f2f5]" />
            <div className="h-5 w-1/2 animate-pulse rounded-full bg-[#f0f2f5]" />
          </div>
        </div>
      ))}
    </div>
  );
}