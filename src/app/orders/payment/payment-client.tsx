"use client";

import Image from "next/image";
import Link from "next/link";
import { CreditCard, Landmark, Smartphone, WalletCards } from "lucide-react";
import { useState } from "react";

type PaymentClientProps = {
  order: {
    id: string;
    title: string;
    seller: string;
    total: string;
    image: string;
  };
};

const methods = [
  { key: "card", label: "Carte bancaire", icon: CreditCard, detail: "Visa, Mastercard, cartes locales" },
  { key: "bank", label: "Virement bancaire", icon: Landmark, detail: "Validation sous contrôle AfriPay" },
  { key: "mobile", label: "Mobile Money", icon: Smartphone, detail: "Paiement rapide sur téléphone" },
];

export function PaymentClient({ order }: PaymentClientProps) {
  const [selectedMethod, setSelectedMethod] = useState(methods[0].key);
  const [isPaid, setIsPaid] = useState(false);

  return (
    <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
      <section className="rounded-[28px] bg-white px-5 py-5 shadow-[0_8px_30px_rgba(24,39,75,0.05)] ring-1 ring-black/5 sm:px-7 sm:py-7">
        <div className="inline-flex items-center gap-2 rounded-full bg-[#fff2e9] px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#d85300]">
          <WalletCards className="h-4 w-4" />
          Paiement de commande
        </div>
        <h1 className="mt-4 text-[28px] font-bold tracking-[-0.05em] text-[#222] sm:text-[40px]">Payer maintenant</h1>
        <p className="mt-2 max-w-[760px] text-[14px] leading-6 text-[#666] sm:text-[16px] sm:leading-8">
          Choisissez votre moyen de paiement pour valider la commande et lancer le traitement AfriPay.
        </p>

        {isPaid ? (
          <div className="mt-5 rounded-[18px] border border-[#c8ead1] bg-[#effbf2] px-4 py-4 text-[14px] font-medium text-[#1f7a39]">
            Paiement initié avec succès pour {order.id}. La commande sera mise à jour après validation.
          </div>
        ) : null}

        <div className="mt-6 space-y-3">
          {methods.map((method) => {
            const Icon = method.icon;
            const isSelected = selectedMethod === method.key;

            return (
              <button
                key={method.key}
                type="button"
                onClick={() => setSelectedMethod(method.key)}
                className={[
                  "flex w-full items-start gap-3 rounded-[20px] border px-4 py-4 text-left transition",
                  isSelected ? "border-[#ff6a00] bg-[#fff5ed] shadow-[inset_0_0_0_1px_#ff6a00]" : "border-[#e5e5e5] bg-white hover:border-[#ffb48a]",
                ].join(" ")}
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-white text-[#ff6a00] ring-1 ring-black/5">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[16px] font-semibold text-[#222]">{method.label}</div>
                  <div className="mt-1 text-[13px] leading-5 text-[#666]">{method.detail}</div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => setIsPaid(true)}
            className="inline-flex h-12 items-center justify-center rounded-full bg-[#ea5c00] px-6 text-[15px] font-semibold text-white transition hover:bg-[#d85400]"
          >
            Confirmer le paiement
          </button>
          <Link href="/orders" className="inline-flex h-12 items-center justify-center rounded-full border border-[#222] px-6 text-[15px] font-semibold text-[#222] transition hover:border-[#ff6a00] hover:text-[#ff6a00]">
            Retour aux commandes
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

        <div className="mt-5 space-y-3 rounded-[20px] bg-[#fafafa] px-4 py-4 ring-1 ring-black/5">
          <div>
            <div className="text-[12px] text-[#777]">Vendeur</div>
            <div className="mt-1 text-[15px] font-semibold text-[#222]">{order.seller}</div>
          </div>
          <div>
            <div className="text-[12px] text-[#777]">Montant à payer</div>
            <div className="mt-1 text-[22px] font-bold tracking-[-0.04em] text-[#ea5c00]">{order.total}</div>
          </div>
        </div>
      </aside>
    </div>
  );
}