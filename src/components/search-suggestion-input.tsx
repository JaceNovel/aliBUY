"use client";

import { Search } from "lucide-react";
import { useEffect, useState } from "react";

type SearchSuggestionInputProps = {
  name: string;
  defaultValue?: string;
  placeholder: string;
  inputClassName: string;
  wrapperClassName?: string;
  panelClassName?: string;
};

export function SearchSuggestionInput({
  name,
  defaultValue = "",
  placeholder,
  inputClassName,
  wrapperClassName,
  panelClassName,
}: SearchSuggestionInputProps) {
  const [query, setQuery] = useState(defaultValue);
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadSuggestions() {
      try {
        const response = await fetch(`/api/search-suggestions?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        const payload = await response.json();
        setSuggestions(Array.isArray(payload?.suggestions) ? payload.suggestions : []);
      } catch {
        if (!controller.signal.aborted) {
          setSuggestions([]);
        }
      }
    }

    void loadSuggestions();

    return () => {
      controller.abort();
    };
  }, [query]);

  return (
    <div className={wrapperClassName ?? "relative"}>
      <label className="block">
        <span className="sr-only">Recherche produit</span>
        <input
          type="search"
          name={name}
          value={query}
          autoComplete="off"
          placeholder={placeholder}
          className={inputClassName}
          onFocus={() => setIsOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          onBlur={() => {
            window.setTimeout(() => setIsOpen(false), 120);
          }}
        />
      </label>

      {isOpen && suggestions.length > 0 ? (
        <div className={panelClassName ?? "absolute left-0 right-0 top-[calc(100%+14px)] z-30 rounded-[28px] border border-black/5 bg-white p-4 shadow-[0_24px_48px_rgba(17,24,39,0.16)]"}>
          <div className="mb-2 px-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#8b8b8b]">
            Exemples de recherche
          </div>
          <div className="space-y-1">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className="flex w-full items-center gap-3 rounded-[18px] px-3 py-3 text-left text-[16px] font-medium text-[#222] transition hover:bg-[#f7f7f7]"
                onMouseDown={(event) => {
                  event.preventDefault();
                  setQuery(suggestion);
                  setIsOpen(false);
                }}
              >
                <Search className="h-4 w-4 text-[#8b8b8b]" />
                <span>{suggestion}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}