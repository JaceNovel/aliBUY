"use client";

import Image from "next/image";
import { useMemo, useRef, useState } from "react";
import { Building2, FileUp, Landmark, ShieldCheck, UploadCloud, X } from "lucide-react";

import type { OrderRecord } from "@/lib/orders-data";

const checklist = [
  "Reference de commande correcte",
  "Montant du virement visible",
  "Nom de la banque et date de paiement",
  "Capture ou PDF lisible",
];

type RemittanceProofClientProps = {
  currencyCode: string;
  orders: OrderRecord[];
  initialOrderId?: string;
};

export function RemittanceProofClient({ currencyCode, orders, initialOrderId }: RemittanceProofClientProps) {
  if (orders.length === 0) {
    return (
      <section className="rounded-[30px] bg-white px-8 py-8 shadow-[0_8px_30px_rgba(24,39,75,0.05)] ring-1 ring-black/5">
        <h1 className="text-[32px] font-bold tracking-[-0.05em] text-[#222]">Aucune commande a justifier</h1>
        <p className="mt-3 text-[15px] leading-7 text-[#666]">
          Vous n&apos;avez pas encore de commande en attente de preuve de virement sur ce compte.
        </p>
      </section>
    );
  }

  const initialOrder = orders.find((order) => order.id === initialOrderId) ?? orders[0];
  const [selectedOrderId, setSelectedOrderId] = useState(initialOrder.id);
  const [amount, setAmount] = useState(initialOrder.total || `${currencyCode} 0`);
  const [transferDate, setTransferDate] = useState(new Date().toISOString().slice(0, 10));
  const [bankName, setBankName] = useState("");
  const [bankReference, setBankReference] = useState("");
  const [comment, setComment] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const currentOrder = useMemo(() => {
    return orders.find((order) => order.id === selectedOrderId) ?? initialOrder;
  }, [initialOrder, selectedOrderId]);

  const handleOrderChange = (nextOrderId: string) => {
    const nextOrder = orders.find((order) => order.id === nextOrderId);

    if (!nextOrder) {
      return;
    }

    setSelectedOrderId(nextOrder.id);
    setAmount(nextOrder.total || `${currencyCode} 0`);
    setSuccessMessage("");
  };

  const handleFileChange = (file: File | null) => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedFile(file);
    setSuccessMessage("");

    if (!file) {
      setPreviewUrl(null);
      return;
    }

    if (file.type.startsWith("image/")) {
      setPreviewUrl(URL.createObjectURL(file));
      return;
    }

    setPreviewUrl(null);
  };

  const handleSubmit = () => {
    setSuccessMessage(`Preuve envoyee avec succes pour la commande ${currentOrder.orderNumber}. Verification AfriPay en cours.`);
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <section className="rounded-[30px] bg-white px-8 py-8 shadow-[0_8px_30px_rgba(24,39,75,0.05)] ring-1 ring-black/5">
        <div className="inline-flex items-center gap-2 rounded-full bg-[#fff2e9] px-4 py-2 text-[13px] font-semibold uppercase tracking-[0.16em] text-[#d85300]">
          <Landmark className="h-4 w-4" />
          Preuve de virement
        </div>
        <h1 className="mt-5 text-[40px] font-bold tracking-[-0.05em] text-[#222]">Soumettre une preuve de virement</h1>
        <p className="mt-3 max-w-[780px] text-[16px] leading-8 text-[#666]">
          Envoyez votre justificatif de paiement pour accelerer la verification AfriPay et debloquer le traitement de votre commande.
        </p>

        {successMessage ? (
          <div className="mt-6 rounded-[18px] border border-[#bce6c8] bg-[#effbf2] px-5 py-4 text-[14px] font-medium text-[#1e7a36]">
            {successMessage}
          </div>
        ) : null}

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <label className="space-y-2 text-[15px] font-semibold text-[#333] md:col-span-2">
            <span>Commande concernee</span>
            <select
              value={selectedOrderId}
              onChange={(event) => handleOrderChange(event.target.value)}
              className="h-14 w-full rounded-[16px] border border-[#dde2ea] bg-white px-5 text-[15px] font-medium text-[#333] outline-none focus:border-[#ff6a00]"
            >
              {orders.map((order) => (
                <option key={order.id} value={order.id}>
                  {order.id} - {order.total}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2 text-[15px] font-semibold text-[#333]">
            <span>Montant envoye</span>
            <input value={amount} onChange={(event) => setAmount(event.target.value)} className="h-14 w-full rounded-[16px] border border-[#dde2ea] px-5 text-[15px] outline-none focus:border-[#ff6a00]" />
          </label>

          <label className="space-y-2 text-[15px] font-semibold text-[#333]">
            <span>Date du virement</span>
            <input type="date" value={transferDate} onChange={(event) => setTransferDate(event.target.value)} className="h-14 w-full rounded-[16px] border border-[#dde2ea] px-5 text-[15px] outline-none focus:border-[#ff6a00]" />
          </label>

          <label className="space-y-2 text-[15px] font-semibold text-[#333]">
            <span>Banque emettrice</span>
            <input value={bankName} onChange={(event) => setBankName(event.target.value)} className="h-14 w-full rounded-[16px] border border-[#dde2ea] px-5 text-[15px] outline-none focus:border-[#ff6a00]" />
          </label>

          <label className="space-y-2 text-[15px] font-semibold text-[#333]">
            <span>Reference bancaire</span>
            <input value={bankReference} onChange={(event) => setBankReference(event.target.value)} className="h-14 w-full rounded-[16px] border border-[#dde2ea] px-5 text-[15px] outline-none focus:border-[#ff6a00]" />
          </label>

          <label className="space-y-2 text-[15px] font-semibold text-[#333] md:col-span-2">
            <span>Commentaire</span>
            <textarea value={comment} onChange={(event) => setComment(event.target.value)} className="min-h-[150px] w-full rounded-[16px] border border-[#dde2ea] px-5 py-4 text-[15px] outline-none focus:border-[#ff6a00]" />
          </label>
        </div>

        <div className="mt-6 rounded-[22px] border border-dashed border-[#cfd6e1] bg-[#fafafa] px-6 py-7 text-center">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            className="hidden"
            onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
          />

          {!selectedFile ? (
            <>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#fff2e9] text-[#d85300]">
                <UploadCloud className="h-6 w-6" />
              </div>
              <div className="mt-4 text-[18px] font-semibold text-[#222]">Ajouter votre justificatif</div>
              <div className="mt-2 text-[14px] leading-6 text-[#666]">Glissez un fichier ici ou utilisez le bouton ci-dessous. Formats recommandes: PDF, PNG, JPG.</div>
            </>
          ) : (
            <div className="rounded-[18px] bg-white px-5 py-5 ring-1 ring-black/5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 text-left">
                  <div className="text-[16px] font-semibold text-[#222]">{selectedFile.name}</div>
                  <div className="mt-1 text-[13px] text-[#666]">{Math.max(1, Math.round(selectedFile.size / 1024))} KB</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleFileChange(null)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#ddd] text-[#666] transition hover:border-[#ff6a00] hover:text-[#ff6a00]"
                  aria-label="Supprimer le fichier"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {previewUrl ? (
                <div className="relative mt-4 h-[260px] overflow-hidden rounded-[16px] bg-[#f5f5f5]">
                  <Image src={previewUrl} alt={selectedFile.name} fill sizes="(min-width: 1280px) 35vw, 90vw" className="object-contain" unoptimized />
                </div>
              ) : (
                <div className="mt-4 flex items-center gap-3 rounded-[14px] bg-[#fafafa] px-4 py-4 text-left text-[14px] text-[#555]">
                  <FileUp className="h-4 w-4 text-[#d85300]" />
                  Apercu fichier disponible pour verification AfriPay.
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mt-5 inline-flex h-12 items-center gap-3 rounded-full border border-[#222] px-6 text-[15px] font-semibold text-[#222] transition hover:border-[#ff6a00] hover:text-[#ff6a00]"
          >
            <FileUp className="h-4 w-4" />
            {selectedFile ? "Remplacer le fichier" : "Choisir un fichier"}
          </button>
        </div>

        <div className="mt-8 flex flex-wrap gap-4">
          <button onClick={handleSubmit} className="inline-flex h-13 items-center justify-center rounded-full bg-[#ff6a00] px-8 text-[16px] font-semibold text-white transition hover:bg-[#ef6100]">
            Envoyer la preuve
          </button>
          <button className="inline-flex h-13 items-center justify-center rounded-full border border-[#222] px-8 text-[16px] font-semibold text-[#222] transition hover:border-[#ff6a00] hover:text-[#ff6a00]">
            Enregistrer comme brouillon
          </button>
        </div>
      </section>

      <aside className="space-y-6">
        <article className="rounded-[26px] bg-[linear-gradient(145deg,#22120d_0%,#552313_48%,#d34a00_100%)] px-7 py-7 text-white shadow-[0_20px_48px_rgba(66,31,12,0.2)]">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[12px] font-semibold uppercase tracking-[0.16em] text-white/80">
            <ShieldCheck className="h-4 w-4" />
            Verification AfriPay
          </div>
          <h2 className="mt-5 text-[30px] font-bold tracking-[-0.05em]">Traitement securise du paiement</h2>
          <p className="mt-3 text-[15px] leading-7 text-white/82">
            Nos equipes verifient la preuve de virement avant de mettre a jour l&apos;etat de la commande et d&apos;en informer le fournisseur.
          </p>
        </article>

        <article className="rounded-[26px] bg-white px-7 py-7 shadow-[0_8px_30px_rgba(24,39,75,0.05)] ring-1 ring-black/5">
          <div className="flex items-center gap-3 text-[20px] font-bold tracking-[-0.04em] text-[#222]">
            <Building2 className="h-5 w-5" />
            Controle avant envoi
          </div>
          <div className="mt-5 space-y-3">
            {checklist.map((item) => (
              <div key={item} className="rounded-[16px] bg-[#fafafa] px-4 py-3 text-[14px] text-[#444] ring-1 ring-black/5">
                {item}
              </div>
            ))}
          </div>
        </article>
      </aside>
    </div>
  );
}