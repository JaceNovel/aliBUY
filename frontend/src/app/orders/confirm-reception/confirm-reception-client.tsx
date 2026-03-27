"use client";

import Image from "next/image";
import Link from "next/link";
import { CheckCheck, PackageCheck, ShieldCheck } from "lucide-react";
import { useState } from "react";

type ConfirmReceptionClientProps = {
  order: {
    id: string;
    title: string;
    total: string;
    image: string;
    seller: string;
  };
};

export function ConfirmReceptionClient({ order }: ConfirmReceptionClientProps) {
  const [isConfirmed, setIsConfirmed] = useState(false);

  return (
    <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
      <section className="rounded-[28px] bg-white px-5 py-5 shadow-[0_8px_30px_rgba(24,39,75,0.05)] ring-1 ring-black/5 sm:px-7 sm:py-7">
        <div className="inline-flex items-center gap-2 rounded-full bg-[#edf8f1] px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#127a46]">
          <PackageCheck className="h-4 w-4" />
          Confirmation de réception
        </div>
        <h1 className="mt-4 text-[28px] font-bold tracking-[-0.05em] text-[#222] sm:text-[40px]">Confirmer la réception</h1>
        <p className="mt-2 max-w-[760px] text-[14px] leading-6 text-[#666] sm:text-[16px] sm:leading-8">
          Indiquez si la commande a bien été reçue afin de clôturer le suivi et confirmer la bonne remise.
        </p>

        {isConfirmed ? (
          <div className="mt-5 rounded-[18px] border border-[#c8ead1] bg-[#effbf2] px-4 py-4 text-[14px] font-medium text-[#1f7a39]">
            Réception confirmée pour {order.id}. AfriPay clôture le dossier et archive la livraison.
          </div>
        ) : null}

        <div className="mt-6 space-y-3 rounded-[20px] bg-[#fafafa] px-4 py-4 ring-1 ring-black/5">
          {[
            "Produit reçu en bon état",
            "Quantité conforme à la commande",
            "Aucun litige de livraison à signaler",
          ].map((item) => (
            <div key={item} className="flex items-start gap-3 text-[14px] text-[#333]">
              <CheckCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#127a46]" />
              <span>{item}</span>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => setIsConfirmed(true)}
            className="inline-flex h-12 items-center justify-center rounded-full bg-[#127a46] px-6 text-[15px] font-semibold text-white transition hover:bg-[#0f683c]"
          >
            Confirmer la réception
          </button>
          <Link href="/messages" className="inline-flex h-12 items-center justify-center rounded-full border border-[#222] px-6 text-[15px] font-semibold text-[#222] transition hover:border-[#ff6a00] hover:text-[#ff6a00]">
            Signaler un problème
          </Link>
        </div>
      </section>

      <aside className="rounded-[28px] bg-white px-5 py-5 shadow-[0_8px_30px_rgba(24,39,75,0.05)] ring-1 ring-black/5 sm:px-7 sm:py-7">
        <div className="flex gap-4">
          <div className="relative h-[92px] w-[92px] shrink-0 overflow-hidden rounded-[18px] bg-[#f4f4f4]">
            <Image src={order.image} alt={order.title} fill sizes="92px" className="object-cover" />
          </div>
          <div className="min-w-0">
            <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#7b7b7b]">Commande</div>
            <div className="mt-1 break-all text-[15px] font-semibold text-[#222]">{order.id}</div>
            <div className="mt-2 line-clamp-2 text-[14px] leading-5 text-[#444]">{order.title}</div>
          </div>
        </div>

        <div className="mt-5 rounded-[20px] bg-[#fafafa] px-4 py-4 ring-1 ring-black/5">
          <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-[#127a46]">
            <ShieldCheck className="h-4 w-4" />
            Vérification AfriPay
          </div>
          <div className="mt-3 text-[14px] leading-6 text-[#555]">
            Une fois la réception confirmée, l’historique logistique de la commande est archivé comme livré.
          </div>
          <div className="mt-4 text-[15px] font-semibold text-[#222]">Montant: {order.total}</div>
          <div className="mt-1 text-[13px] text-[#666]">Vendeur: {order.seller}</div>
        </div>
      </aside>
    </div>
  );
}