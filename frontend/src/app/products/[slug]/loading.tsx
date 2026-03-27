function ProductDetailLoadingSkeleton() {
  return (
    <main className="min-h-screen overflow-x-clip bg-[#f7f7f7] pb-24 text-[#222] md:pb-0">
      <header className="border-b border-[#e5e5e5] bg-white">
        <div className="mx-auto max-w-[1680px] px-4 sm:px-6 xl:px-10">
          <div className="xl:hidden">
            <div className="flex items-center justify-between gap-3 border-b border-[#f0ebe6] py-3">
              <div className="h-8 w-28 animate-pulse rounded-full bg-[#f3efe9]" />
              <div className="h-8 w-28 animate-pulse rounded-full bg-[#f3efe9]" />
            </div>
            <div className="py-3.5">
              <div className="h-8 w-28 animate-pulse rounded-[12px] bg-[#f3efe9]" />
            </div>
            <div className="border-b border-[#f0ebe6] pb-4">
              <div className="h-[58px] animate-pulse rounded-[18px] border border-[#ddd6d0] bg-[#fffdfa]" />
            </div>
            <div className="grid grid-cols-4 gap-3 py-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-11 animate-pulse rounded-[16px] bg-[#f8f3ed]" />
              ))}
            </div>
          </div>

          <div className="hidden min-h-[74px] flex-col gap-3 py-3 xl:flex xl:flex-row xl:items-center xl:justify-between">
            <div className="h-9 w-32 animate-pulse rounded-[12px] bg-[#f3efe9]" />
            <div className="h-[60px] flex-1 animate-pulse rounded-[22px] border border-[#d9d9d9] bg-white shadow-[0_8px_24px_rgba(17,24,39,0.04)]" />
            <div className="flex items-center gap-3 sm:gap-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-10 w-10 animate-pulse rounded-full bg-[#f3efe9]" />
              ))}
            </div>
          </div>

          <div className="hidden border-t border-[#efefef] py-3 xl:block">
            <div className="flex items-center justify-between">
              <div className="flex gap-6">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="h-6 w-28 animate-pulse rounded-[8px] bg-[#f3efe9]" />
                ))}
              </div>
              <div className="flex gap-6">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="h-6 w-24 animate-pulse rounded-[8px] bg-[#f3efe9]" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1680px] px-4 py-5 sm:px-6 sm:py-8 xl:px-10">
        <div className="sm:hidden">
          <div className="rounded-[28px] bg-white p-4 shadow-[0_16px_40px_rgba(17,24,39,0.05)] ring-1 ring-black/5">
            <div className="aspect-[1/0.92] animate-pulse rounded-[24px] bg-[#f1ece5]" />
            <div className="mt-4 h-7 w-[78%] animate-pulse rounded-[10px] bg-[#f1ece5]" />
            <div className="mt-3 h-10 w-40 animate-pulse rounded-[10px] bg-[#fff1e5]" />
            <div className="mt-5 grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-24 animate-pulse rounded-[18px] bg-[#f7f3ee]" />
              ))}
            </div>
          </div>
        </div>

        <div className="hidden sm:block">
          <div className="h-4 w-72 animate-pulse rounded-[8px] bg-[#efe8df]" />
          <section className="mt-4 rounded-[30px] bg-white px-4 py-4 shadow-[0_18px_48px_rgba(24,39,75,0.06)] ring-1 ring-black/5 sm:px-5 sm:py-5 lg:px-6 lg:py-6">
            <div className="grid gap-6 xl:grid-cols-[88px_580px_minmax(0,1fr)]">
              <div className="order-2 flex gap-3 overflow-hidden xl:order-1 xl:flex-col">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="h-[82px] min-w-[82px] animate-pulse rounded-[18px] bg-[#f1ece5]" />
                ))}
              </div>

              <div className="order-1 xl:order-2">
                <div className="aspect-[1/0.88] animate-pulse rounded-[28px] bg-[#f1ece5] ring-1 ring-black/5" />
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="h-24 animate-pulse rounded-[18px] bg-[#f7f3ee]" />
                  ))}
                </div>
                <div className="mt-4 h-72 animate-pulse rounded-[26px] bg-[#faf8f4] ring-1 ring-black/5" />
              </div>

              <div className="order-3 min-w-0 rounded-[28px] border border-[#ededed] bg-white px-5 py-5 xl:px-6 xl:py-6">
                <div className="h-4 w-40 animate-pulse rounded-[8px] bg-[#f1ece5]" />
                <div className="mt-4 h-10 w-[92%] animate-pulse rounded-[10px] bg-[#f1ece5]" />
                <div className="mt-3 h-5 w-52 animate-pulse rounded-[8px] bg-[#f6f2ed]" />
                <div className="mt-6 h-56 animate-pulse rounded-[24px] bg-[#fff1e5]" />
                <div className="mt-6 space-y-4">
                  {Array.from({ length: 2 }).map((_, index) => (
                    <div key={index}>
                      <div className="h-4 w-24 animate-pulse rounded-[8px] bg-[#f1ece5]" />
                      <div className="mt-3 flex gap-2">
                        {Array.from({ length: 3 }).map((__, buttonIndex) => (
                          <div key={buttonIndex} className="h-10 w-24 animate-pulse rounded-full bg-[#f7f3ee]" />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <div className="h-13 animate-pulse rounded-full bg-[#ffe0c8]" />
                  <div className="h-13 animate-pulse rounded-full bg-[#f7f3ee]" />
                </div>
              </div>
            </div>
          </section>

          <section className="mt-6 rounded-[30px] bg-white px-4 py-5 shadow-[0_12px_36px_rgba(24,39,75,0.06)] ring-1 ring-black/5 sm:px-6 sm:py-6">
            <div className="h-4 w-28 animate-pulse rounded-[8px] bg-[#f1ece5]" />
            <div className="mt-3 h-9 w-56 animate-pulse rounded-[10px] bg-[#f1ece5]" />
            <div className="mt-5 grid gap-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-20 animate-pulse rounded-[18px] bg-[#faf8f4]" />
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

export default ProductDetailLoadingSkeleton;