"use client";

import { FileUp, PackageSearch, Send, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type QuoteRequestFormProps = {
  currencyCode: string;
  shippingWindow: string;
};

export function QuoteRequestForm({ currencyCode, shippingWindow }: QuoteRequestFormProps) {
  const router = useRouter();
  const [productName, setProductName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [specifications, setSpecifications] = useState("");
  const [budget, setBudget] = useState(`${currencyCode} `);
  const [windowValue, setWindowValue] = useState(shippingWindow);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      setNotes("");
      setSuccess("Votre demande a bien ete enregistree.");
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