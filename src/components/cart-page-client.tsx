"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, Ship, ShoppingCart, Truck } from "lucide-react";
import { useMemo, useState } from "react";

import { useCart, useCartQuote } from "@/components/cart-provider";
import { buildCartItemKey, formatFcfa } from "@/lib/alibaba-sourcing";

export function CartPageClient() {
  const { items, updateItem, removeItem, clearCart } = useCart();
  const { quote, isLoading } = useCartQuote();
  const [selectedShipping, setSelectedShipping] = useState<"air" | "sea">("air");

  const shipping = useMemo(() => quote.shippingOptions.find((option) => option.key === selectedShipping) ?? quote.shippingOptions[0], [quote.shippingOptions, selectedShipping]);
  const totalFcfa = quote.cartProductsTotalFcfa + (shipping?.priceFcfa ?? 0);

  if (items.length === 0) {
    return (
      <section className="rounded-[28px] border border-[#ece7df] bg-white px-5 py-10 text-center shadow-[0_16px_40px_rgba(17,24,39,0.05)] sm:px-8">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#fff0e6] text-[#ff6a00]">
          <ShoppingCart className="h-8 w-8" />
        </div>
        <h1 className="mt-5 text-[28px] font-black tracking-[-0.05em] text-[#1f2937]">Votre panier sourcing est vide</h1>
        <p className="mt-3 text-[14px] leading-6 text-[#667085]">Ajoutez des produits pour calculer automatiquement le poids total, le volume CBM, les options avion/bateau et vos tarifs finaux en FCFA.</p>
        <Link href="/products" className="mt-6 inline-flex h-12 items-center justify-center rounded-full bg-[#ff6a00] px-6 text-[15px] font-semibold text-white transition hover:bg-[#e55e00]">
          Retour au catalogue
        </Link>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-[#ece7df] bg-[linear-gradient(135deg,#fff6ef_0%,#ffffff_45%,#eef6ff_100%)] px-5 py-6 shadow-[0_16px_40px_rgba(17,24,39,0.05)] sm:px-8 sm:py-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#ff6a00]">Alibaba sourcing</div>
            <h1 className="mt-2 text-[30px] font-black tracking-[-0.05em] text-[#1f2937]">Panier, transport et prix finaux</h1>
            <p className="mt-3 max-w-[760px] text-[14px] leading-6 text-[#667085]">Livraison avion offerte dès 15 000 FCFA, calcul du poids et du volume en direct, plus regroupement maritime vers un conteneur dès que le volume cumulé atteint 1 CBM.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[18px] bg-white px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
              <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">Poids total</div>
              <div className="mt-2 text-[23px] font-black tracking-[-0.04em] text-[#1f2937]">{quote.totalWeightKg.toFixed(2)} kg</div>
            </div>
            <div className="rounded-[18px] bg-white px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
              <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">Volume total</div>
              <div className="mt-2 text-[23px] font-black tracking-[-0.04em] text-[#1f2937]">{quote.totalCbm.toFixed(4)} CBM</div>
            </div>
            <div className="rounded-[18px] bg-white px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
              <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">Sous-total</div>
              <div className="mt-2 text-[23px] font-black tracking-[-0.04em] text-[#1f2937]">{formatFcfa(quote.cartProductsTotalFcfa)}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4 rounded-[28px] border border-[#ece7df] bg-white p-4 shadow-[0_16px_40px_rgba(17,24,39,0.05)] sm:p-6">
          {quote.items.map((item) => {
            const cartItem = items.find((entry) => buildCartItemKey(entry.slug, entry.selectedVariants) === (item.cartKey ?? item.slug));
            const quantity = cartItem?.quantity ?? item.quantity;

            return (
              <article key={item.cartKey ?? item.slug} className="grid gap-4 rounded-[22px] border border-[#edf1f6] px-4 py-4 sm:grid-cols-[96px_minmax(0,1fr)]">
                <div className="relative h-24 overflow-hidden rounded-[18px] bg-[#f5f5f5]">
                  <Image src={item.image} alt={item.title} fill sizes="96px" className="object-cover" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="text-[17px] font-semibold text-[#1f2937]">{item.title}</div>
                      <div className="mt-1 text-[13px] text-[#667085]">Prix fournisseur: {formatFcfa(item.supplierPriceFcfa)} · Marge/unité: {formatFcfa(item.marginAmountFcfa)}</div>
                      <div className="mt-1 text-[13px] text-[#667085]">{item.weightKg.toFixed(2)} kg/unité · {item.volumeCbm.toFixed(4)} CBM/unité</div>
                    </div>
                    <div className="text-[18px] font-black tracking-[-0.04em] text-[#1f2937]">{formatFcfa(item.finalLinePriceFcfa)}</div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => updateItem(item.cartKey ?? item.slug, quantity - 1)} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#d9dfe8] text-[#344054] transition hover:border-[#ff6a00] hover:text-[#ff6a00]">
                        <Minus className="h-4 w-4" />
                      </button>
                      <div className="min-w-[28px] text-center text-[18px] font-semibold text-[#1f2937]">{quantity}</div>
                      <button type="button" onClick={() => updateItem(item.cartKey ?? item.slug, quantity + 1)} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#d9dfe8] text-[#344054] transition hover:border-[#ff6a00] hover:text-[#ff6a00]">
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <button type="button" onClick={() => removeItem(item.cartKey ?? item.slug)} className="text-[13px] font-semibold text-[#d92d20] transition hover:opacity-80">
                      Retirer
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <aside className="space-y-4">
          <section className="rounded-[28px] border border-[#ece7df] bg-white p-5 shadow-[0_16px_40px_rgba(17,24,39,0.05)]">
            <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#ff6a00]">Options de livraison</div>
            <div className="mt-4 space-y-3">
              {quote.shippingOptions.map((option) => {
                const isActive = selectedShipping === option.key;
                const Icon = option.key === "air" ? Truck : Ship;

                return (
                  <button key={option.key} type="button" onClick={() => setSelectedShipping(option.key)} className={["flex w-full items-start gap-3 rounded-[20px] border px-4 py-4 text-left transition", isActive ? "border-[#ff6a00] bg-[#fff5ed]" : "border-[#e6eaf0] bg-white hover:border-[#ffb48a]"].join(" ")}>
                    <div className={["mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-[14px]", option.key === "air" ? "bg-[#fff0e6] text-[#ff6a00]" : "bg-[#eaf3ff] text-[#2f67f6]"].join(" ")}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-[16px] font-semibold text-[#1f2937]">{option.label}</div>
                        <div className="text-[16px] font-black tracking-[-0.03em] text-[#1f2937]">{option.isFree ? "Gratuite" : formatFcfa(option.priceFcfa)}</div>
                      </div>
                      <div className="mt-1 text-[13px] text-[#667085]">{option.tradeLabel}</div>
                      <div className="mt-1 text-[13px] text-[#667085]">Délai estimé: {option.deliveryWindow}</div>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="mt-4 rounded-[18px] bg-[#f8fafc] px-4 py-3 text-[13px] font-medium text-[#475467]">Free delivery from 15,000 FCFA. {quote.freeShippingMessage}</div>
          </section>

          <section className="rounded-[28px] border border-[#ece7df] bg-white p-5 shadow-[0_16px_40px_rgba(17,24,39,0.05)]">
            <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#ff6a00]">Groupage maritime</div>
            <div className="mt-3 text-[14px] leading-6 text-[#667085]">Si vous choisissez le bateau, votre commande entre dans le conteneur en attente jusqu’à 1 CBM.</div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-[#edf1f6]">
              <div className="h-full rounded-full bg-[linear-gradient(90deg,#2f67f6_0%,#61a7ff_100%)]" style={{ width: `${quote.containerProjection.projectedFillPercent}%` }} />
            </div>
            <div className="mt-3 flex items-center justify-between text-[13px] text-[#667085]">
              <span>{quote.containerProjection.projectedCbm.toFixed(4)} / {quote.containerProjection.targetCbm.toFixed(2)} CBM</span>
              <span>{quote.containerProjection.projectedFillPercent}% rempli</span>
            </div>
          </section>

          <section className="rounded-[28px] border border-[#ece7df] bg-white p-5 shadow-[0_16px_40px_rgba(17,24,39,0.05)]">
            <div className="flex items-center justify-between">
              <div className="text-[16px] font-semibold text-[#1f2937]">Sous-total produits</div>
              <div className="text-[16px] font-bold text-[#1f2937]">{formatFcfa(quote.cartProductsTotalFcfa)}</div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <div className="text-[16px] font-semibold text-[#1f2937]">Livraison</div>
              <div className="text-[16px] font-bold text-[#1f2937]">{shipping ? (shipping.isFree ? "Gratuite" : formatFcfa(shipping.priceFcfa)) : formatFcfa(0)}</div>
            </div>
            <div className="mt-4 border-t border-[#edf1f6] pt-4">
              <div className="flex items-center justify-between">
                <div className="text-[18px] font-black tracking-[-0.04em] text-[#1f2937]">Total</div>
                <div className="text-[22px] font-black tracking-[-0.05em] text-[#1f2937]">{formatFcfa(totalFcfa)}</div>
              </div>
            </div>
            <div className="mt-5 grid gap-3">
              <Link href="/checkout" className="inline-flex h-12 items-center justify-center rounded-full bg-[#ff6a00] px-6 text-[15px] font-semibold text-white transition hover:bg-[#e55e00]">Passer au checkout</Link>
              <button type="button" onClick={clearCart} className="inline-flex h-12 items-center justify-center rounded-full border border-[#d9dfe8] px-6 text-[15px] font-semibold text-[#344054] transition hover:border-[#ff6a00] hover:text-[#ff6a00]">Vider le panier</button>
            </div>
            {isLoading ? <div className="mt-3 text-[12px] text-[#98a2b3]">Mise à jour du devis sourcing...</div> : null}
          </section>
        </aside>
      </section>
    </div>
  );
}