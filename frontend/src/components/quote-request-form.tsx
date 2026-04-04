"use client";

import { FileUp, PackageSearch, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type QuoteRequestFormProps = {
  currencyCode: string;
  shippingWindow: string;
  initialDraft?: {
    productName?: string;
    quantity?: string;
    specifications?: string;
    budget?: string;
    shippingWindow?: string;
    notes?: string;
  } | null;
};

const QUOTE_DRAFT_STORAGE_KEY = "afripay_quote_draft_v1";

export function QuoteRequestForm({ currencyCode, shippingWindow, initialDraft = null }: QuoteRequestFormProps) {
  const router = useRouter();
  const syncTimeoutRef = useRef<number | null>(null);
  const hydratedRef = useRef(false);
  const [productName, setProductName] = useState(initialDraft?.productName ?? "");
  const [quantity, setQuantity] = useState(initialDraft?.quantity ?? "");
  const [specifications, setSpecifications] = useState(initialDraft?.specifications ?? "");
  const [budget, setBudget] = useState(initialDraft?.budget ?? `${currencyCode} `);
  const [windowValue, setWindowValue] = useState(initialDraft?.shippingWindow ?? shippingWindow);
  const [notes, setNotes] = useState(initialDraft?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (hydratedRef.current || typeof window === "undefined") {
      return;
    }

    hydratedRef.current = true;

    try {
      const raw = window.localStorage.getItem(QUOTE_DRAFT_STORAGE_KEY);
      if (!raw) {
        return;
      }

      const draft = JSON.parse(raw) as QuoteRequestFormProps["initialDraft"];
      if (!draft) {
        return;
      }

      setProductName((current) => current || draft.productName || "");
      setQuantity((current) => current || draft.quantity || "");
      setSpecifications((current) => current || draft.specifications || "");
      setBudget((current) => current.trim() !== `${currencyCode}` ? current : draft.budget || `${currencyCode} `);
      setWindowValue((current) => current || draft.shippingWindow || shippingWindow);
      setNotes((current) => current || draft.notes || "");
    } catch {
      // Ignore local draft parsing issues.
    }
  }, [currencyCode, shippingWindow]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const draft = {
      productName,
      quantity,
      specifications,
      budget,
      shippingWindow: windowValue,
      notes,
    };
    const hasMeaningfulDraft = Boolean(productName.trim() || quantity.trim() || specifications.trim() || notes.trim());

    try {
      if (hasMeaningfulDraft) {
        window.localStorage.setItem(QUOTE_DRAFT_STORAGE_KEY, JSON.stringify(draft));
      } else {
        window.localStorage.removeItem(QUOTE_DRAFT_STORAGE_KEY);
      }
    } catch {
      // Ignore localStorage failures.
    }

    if (syncTimeoutRef.current !== null) {
      window.clearTimeout(syncTimeoutRef.current);
    }

    syncTimeoutRef.current = window.setTimeout(() => {
      void fetch("/api/quotes/draft", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(hasMeaningfulDraft
          ? draft
          : {
              action: "clear",
            }),
      }).catch(() => {
        // Ignore sync failures for draft state.
      });
    }, 1200);

    return () => {
      if (syncTimeoutRef.current !== null) {
        window.clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [budget, notes, productName, quantity, specifications, windowValue]);

  const handleSubmit = async () => {
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/quotes", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          productName,
          quantity,
          specifications,
          budget,
          shippingWindow: windowValue,
          notes,
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setError(payload?.message ?? "Impossible d'envoyer la demande.");
        return;
      }

      setProductName("");
      setQuantity("");
      setSpecifications("");
      setBudget(`${currencyCode} `);
      setWindowValue(shippingWindow);
      setNotes("");
      setSuccess("Votre demande a bien ete enregistree.");
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(QUOTE_DRAFT_STORAGE_KEY);
      }
      void fetch("/api/quotes/draft", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ action: "clear" }),
      }).catch(() => {
        // Ignore cleanup failures.
      });
      router.refresh();
    } catch {
      setError("Impossible d'envoyer la demande.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {success ? <div className="mt-5 rounded-[16px] bg-[#effbf2] px-4 py-3 text-[14px] text-[#127a46]">{success}</div> : null}
      {error ? <div className="mt-5 rounded-[16px] bg-[#fff2f0] px-4 py-3 text-[14px] text-[#b42318]">{error}</div> : null}

      <div className="mt-5 grid gap-4 sm:mt-8 sm:gap-5 md:grid-cols-2">
        <label className="space-y-1.5 text-[13px] font-semibold text-[#333] sm:space-y-2 sm:text-[15px]">
          <span>Nom du produit</span>
          <input value={productName} onChange={(event) => setProductName(event.target.value)} className="h-11 w-full rounded-[14px] border border-[#dde2ea] px-3.5 text-[14px] outline-none focus:border-[#ff6a00] sm:h-14 sm:rounded-[16px] sm:px-5 sm:text-[16px]" />
        </label>
        <label className="space-y-1.5 text-[13px] font-semibold text-[#333] sm:space-y-2 sm:text-[15px]">
          <span>Quantite cible</span>
          <input value={quantity} onChange={(event) => setQuantity(event.target.value)} className="h-11 w-full rounded-[14px] border border-[#dde2ea] px-3.5 text-[14px] outline-none focus:border-[#ff6a00] sm:h-14 sm:rounded-[16px] sm:px-5 sm:text-[16px]" />
        </label>
        <label className="space-y-1.5 text-[13px] font-semibold text-[#333] sm:space-y-2 sm:text-[15px] md:col-span-2">
          <span>Specifications</span>
          <textarea value={specifications} onChange={(event) => setSpecifications(event.target.value)} className="min-h-[132px] w-full rounded-[14px] border border-[#dde2ea] px-3.5 py-3 text-[14px] outline-none focus:border-[#ff6a00] sm:min-h-[180px] sm:rounded-[16px] sm:px-5 sm:py-4 sm:text-[16px]" />
        </label>
        <label className="space-y-1.5 text-[13px] font-semibold text-[#333] sm:space-y-2 sm:text-[15px]">
          <span>Budget cible</span>
          <input value={budget} onChange={(event) => setBudget(event.target.value)} className="h-11 w-full rounded-[14px] border border-[#dde2ea] px-3.5 text-[14px] outline-none focus:border-[#ff6a00] sm:h-14 sm:rounded-[16px] sm:px-5 sm:text-[16px]" />
        </label>
        <label className="space-y-1.5 text-[13px] font-semibold text-[#333] sm:space-y-2 sm:text-[15px]">
          <span>Fenetre logistique</span>
          <input value={windowValue} onChange={(event) => setWindowValue(event.target.value)} className="h-11 w-full rounded-[14px] border border-[#dde2ea] px-3.5 text-[14px] outline-none focus:border-[#ff6a00] sm:h-14 sm:rounded-[16px] sm:px-5 sm:text-[16px]" />
        </label>
        <label className="space-y-1.5 text-[13px] font-semibold text-[#333] sm:space-y-2 sm:text-[15px] md:col-span-2">
          <span>Informations complementaires</span>
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="min-h-[100px] w-full rounded-[14px] border border-[#dde2ea] px-3.5 py-3 text-[14px] outline-none focus:border-[#ff6a00] sm:rounded-[16px] sm:px-5 sm:py-4 sm:text-[16px]" />
        </label>
      </div>

      <div className="mt-5 grid gap-3 sm:mt-6 sm:grid-cols-2 sm:gap-4">
        <div className="flex h-11 items-center justify-center gap-2.5 rounded-[14px] border border-dashed border-[#cfd6e1] bg-[#fafafa] px-3 text-[13px] font-semibold text-[#333] sm:h-14 sm:gap-3 sm:rounded-[18px] sm:text-[16px]">
          <FileUp className="h-4 w-4 sm:h-5 sm:w-5" />
          Ajouter un cahier des charges
        </div>
        <div className="flex h-11 items-center justify-center gap-2.5 rounded-[14px] border border-dashed border-[#cfd6e1] bg-[#fafafa] px-3 text-[13px] font-semibold text-[#333] sm:h-14 sm:gap-3 sm:rounded-[18px] sm:text-[16px]">
          <PackageSearch className="h-4 w-4 sm:h-5 sm:w-5" />
          Ajouter des references produit
        </div>
      </div>

      <button type="button" onClick={handleSubmit} disabled={isSubmitting} className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2.5 rounded-full bg-[#ff6a00] px-5 text-[14px] font-semibold text-white transition hover:bg-[#ef6100] disabled:opacity-60 sm:mt-8 sm:h-14 sm:w-auto sm:gap-3 sm:px-8 sm:text-[18px]">
        <Send className="h-4 w-4 sm:h-5 sm:w-5" />
        {isSubmitting ? "Envoi..." : "Envoyer ma demande de devis"}
      </button>
    </>
  );
}
