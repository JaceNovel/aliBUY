"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, LoaderCircle, Share2 } from "lucide-react";

import { useCart, type SharedCartImportContext } from "@/components/cart-provider";

export function SharedCartClaimClient({ token, ownerDisplayName, message, itemCount }: { token: string; ownerDisplayName: string; message?: string; itemCount: number }) {
  const { replaceItems, setSharedCartContext } = useCart();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const claimedRef = useRef(false);

  useEffect(() => {
    if (claimedRef.current) {
      return;
    }

    claimedRef.current = true;

    void fetch(`/api/cart/shares/${encodeURIComponent(token)}/claim`, {
      method: "POST",
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.cartItems || !payload?.sharedContext) {
          throw new Error(payload?.message || "Impossible d'importer ce panier partagé.");
        }

        replaceItems(payload.cartItems);
        setSharedCartContext(payload.sharedContext as SharedCartImportContext);
        setFeedback(`Le panier de ${ownerDisplayName} a été importé dans votre compte.`);
      })
      .catch((error) => {
        setFeedback(error instanceof Error ? error.message : "Impossible d'importer ce panier partagé.");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [ownerDisplayName, replaceItems, setSharedCartContext, token]);

  return (
    <section className="mx-auto max-w-[760px] rounded-[28px] border border-[#ece7df] bg-white px-6 py-8 text-center shadow-[0_16px_40px_rgba(17,24,39,0.05)]">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#eef6ff] text-[#1d4f91]">
        {isLoading ? <LoaderCircle className="h-8 w-8 animate-spin" /> : <CheckCircle2 className="h-8 w-8" />}
      </div>
      <h1 className="mt-5 text-[30px] font-black tracking-[-0.05em] text-[#1f2937]">Panier partagé AfriPay</h1>
      <p className="mt-3 text-[14px] leading-7 text-[#667085]">Créateur du panier: <span className="font-semibold text-[#1f2937]">{ownerDisplayName}</span> · {itemCount} article{itemCount > 1 ? "s" : ""}</p>
      {message ? <p className="mt-2 text-[14px] leading-7 text-[#475467]">Message: {message}</p> : null}
      {feedback ? <div className="mt-5 rounded-[18px] bg-[#f8fafc] px-4 py-4 text-[14px] font-medium text-[#344054]">{feedback}</div> : null}

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Link href="/cart" className="inline-flex h-12 items-center justify-center rounded-full bg-[#ff6a00] px-6 text-[15px] font-semibold text-white transition hover:bg-[#e55e00]">
          Voir le panier importé
        </Link>
        <Link href="/checkout" className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-[#d9dfe8] px-6 text-[15px] font-semibold text-[#344054] transition hover:border-[#ff6a00] hover:text-[#ff6a00]">
          <Share2 className="h-4 w-4" />
          Aller au checkout
        </Link>
      </div>
    </section>
  );
}