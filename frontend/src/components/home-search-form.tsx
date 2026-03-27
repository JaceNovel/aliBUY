"use client";

import { Camera, LoaderCircle, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { SearchSuggestionInput } from "@/components/search-suggestion-input";

type HomeSearchFormProps = {
  defaultQuery: string;
  placeholderText: string;
  imageSearchLabel: string;
  searchLabel: string;
};

export function HomeSearchForm({ defaultQuery, placeholderText, imageSearchLabel, searchLabel }: HomeSearchFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isImageButtonActive, setIsImageButtonActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    router.prefetch("/search");
    router.prefetch("/search/image");
  }, [router]);

  const triggerImagePicker = () => {
    setIsImageButtonActive(true);
    window.setTimeout(() => setIsImageButtonActive(false), 260);
    fileInputRef.current?.click();
  };

  const handleImageSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setIsUploading(true);
    setErrorMessage("");

    try {
      const formData = new FormData();
      formData.append("image", file);

      const response = await fetch("/api/image-search", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "Recherche par image indisponible.");
      }

      const payload = (await response.json()) as {
        fileName: string;
        results: Array<{ slug: string; score: number }>;
      };
      const slugList = payload.results.map((result) => result.slug).join(",");
      const params = new URLSearchParams();

      if (slugList) {
        params.set("slugs", slugList);
      }

      params.set("name", payload.fileName || file.name);
      router.push(`/search/image?${params.toString()}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Recherche par image indisponible.");
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  };

  return (
    <div className="rounded-[22px] bg-white px-2.5 py-2.5 shadow-[0_20px_45px_rgba(50,30,14,0.12)] ring-1 ring-black/5 sm:rounded-[24px] sm:px-6 sm:py-5">
      <form action="/search" className="rounded-[18px] border border-[#d9d9d9] px-3 py-3 shadow-[0_8px_20px_rgba(34,34,34,0.08)] sm:rounded-[26px] sm:border-[3px] sm:border-[#6f6f6f] sm:px-6 sm:py-6 sm:shadow-[0_12px_28px_rgba(34,34,34,0.12)]">
        <SearchSuggestionInput
          name="q"
          defaultValue={defaultQuery}
          placeholder={placeholderText}
          wrapperClassName="relative"
          inputClassName="h-11 w-full rounded-[12px] border border-[#e6e1db] bg-[#fbfaf8] px-3 text-[13px] text-[#444] outline-none placeholder:text-[#9a9a9a] focus:border-[#ff6a00] sm:h-auto sm:rounded-none sm:border-0 sm:bg-transparent sm:px-0 sm:text-[16px]"
          panelClassName="absolute left-0 right-0 top-[calc(100%+18px)] z-30 rounded-[28px] border border-black/5 bg-white p-6 shadow-[0_28px_60px_rgba(17,24,39,0.18)]"
        />

        <div className="mt-3 flex items-center gap-2 sm:mt-6 sm:flex-col sm:gap-4 lg:flex-row lg:items-center lg:justify-between">
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageSelect}
            />
            <button
              type="button"
              onClick={triggerImagePicker}
              disabled={isUploading}
              className={[
                "inline-flex h-10 shrink-0 items-center gap-2 rounded-[12px] border border-[#e6e1db] bg-[#fbfaf8] px-3 text-[12px] font-semibold text-[#222] transition duration-200 disabled:cursor-not-allowed disabled:text-[#999] sm:h-auto sm:rounded-full sm:border-0 sm:bg-transparent sm:px-4 sm:py-2 sm:text-[16px]",
                isImageButtonActive ? "scale-[1.04] bg-[#fff1e7] text-[#d85300] shadow-[0_10px_18px_rgba(255,106,0,0.14)]" : "hover:bg-[#faf3ee]",
              ].join(" ")}
            >
              {isUploading ? <LoaderCircle className="h-4 w-4 animate-spin sm:h-6 sm:w-6" /> : <Camera className={["h-4 w-4 transition-transform duration-200 sm:h-6 sm:w-6", isImageButtonActive ? "scale-110" : "scale-100"].join(" ")} />}
              <span className="hidden sm:inline">{isUploading ? "Analyse de l'image..." : imageSearchLabel}</span>
            </button>
            {errorMessage ? <div className="text-[13px] text-[#c44512]">{errorMessage}</div> : null}
          </>

          <button type="submit" className="group flex h-10 flex-1 items-center justify-center gap-2 rounded-[12px] bg-[#222] px-4 text-[13px] font-semibold text-white shadow-[0_10px_24px_rgba(34,34,34,0.18)] transition duration-200 hover:-translate-y-0.5 hover:bg-black hover:shadow-[0_16px_30px_rgba(34,34,34,0.24)] active:translate-y-0 active:scale-[0.98] sm:h-14 sm:w-full sm:flex-none sm:gap-3 sm:rounded-full sm:px-6 sm:text-[16px] lg:min-w-[205px] lg:w-auto lg:px-8">
            <Search className="h-4 w-4 transition-transform duration-200 group-hover:scale-110 sm:h-5 sm:w-5" />
            {searchLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
