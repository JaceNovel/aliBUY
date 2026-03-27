export default function Loading() {
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
        <div className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
          <section className="rounded-[28px] bg-white p-5 shadow-[0_16px_40px_rgba(17,24,39,0.05)]">
            <div className="h-8 w-56 animate-pulse rounded-[10px] bg-[#f3efe9]" />
            <div className="mt-4 h-5 w-full animate-pulse rounded-[8px] bg-[#f6f2ed]" />
            <div className="mt-2 h-5 w-[82%] animate-pulse rounded-[8px] bg-[#f6f2ed]" />
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="overflow-hidden rounded-[22px] border border-[#edf1f6] bg-white p-4">
                  <div className="aspect-[1/0.82] animate-pulse rounded-[18px] bg-[#f3efe9]" />
                  <div className="mt-4 h-5 animate-pulse rounded-[8px] bg-[#f6f2ed]" />
                  <div className="mt-2 h-5 w-[76%] animate-pulse rounded-[8px] bg-[#f6f2ed]" />
                  <div className="mt-5 h-8 w-28 animate-pulse rounded-[999px] bg-[#fff1e5]" />
                </div>
              ))}
            </div>
          </section>

          <aside className="space-y-5">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="rounded-[28px] bg-white p-5 shadow-[0_16px_40px_rgba(17,24,39,0.05)]">
                <div className="h-6 w-40 animate-pulse rounded-[8px] bg-[#f3efe9]" />
                <div className="mt-4 h-4 w-full animate-pulse rounded-[8px] bg-[#f6f2ed]" />
                <div className="mt-2 h-4 w-[74%] animate-pulse rounded-[8px] bg-[#f6f2ed]" />
                <div className="mt-5 h-24 animate-pulse rounded-[18px] bg-[#f8f3ed]" />
              </div>
            ))}
          </aside>
        </div>
      </div>
    </main>
  );
}