"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, LoaderCircle, Share2 } from "lucide-react";

import { useCart, type SharedCartImportContext } from "@/components/cart-provider";
import type { CartInputItem } from "@/lib/alibaba-sourcing";

export function SharedCartClaimClient({
  token,
  ownerDisplayName,
  message,
  itemCount,
  cartItems,
  sharedContext,
}: {
  token: string;
  ownerDisplayName: string;
  message?: string;
  itemCount: number;
  cartItems: CartInputItem[];
  sharedContext: SharedCartImportContext;
}) {
  const router = useRouter();
  const { replaceItems, setSharedCartContext } = useCart();
  const [feedback] = useState<string | null>(`Le panier de ${ownerDisplayName} a été importé dans votre compte.`);
  const isLoading = false;
  const [isImported] = useState(true);
  const claimedRef = useRef(false);
  const redirectTimerRef = useRef<number | null>(null);
  const hardRedirectTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (claimedRef.current) {
      return;
    }

    claimedRef.current = true;

    replaceItems(cartItems);
    setSharedCartContext(sharedContext);

    redirectTimerRef.current = window.setTimeout(() => {
      router.replace("/cart");
    }, 120);
    hardRedirectTimerRef.current = window.setTimeout(() => {
      window.location.assign("/cart");
    }, 900);

    void fetch(`/api/cart/shares/${encodeURIComponent(token)}/claim`, {
      method: "POST",
      keepalive: true,
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(payload?.message || "Impossible de confirmer l'import du panier partagé.");
        }
      })
      .catch(() => {
        // Le panier est deja importe localement; un echec de marquage ne doit pas bloquer l'utilisateur.
      });

    return () => {
      if (redirectTimerRef.current !== null) {
        window.clearTimeout(redirectTimerRef.current);
        redirectTimerRef.current = null;
      }
      if (hardRedirectTimerRef.current !== null) {
        window.clearTimeout(hardRedirectTimerRef.current);
        hardRedirectTimerRef.current = null;
      }
    };
  }, [cartItems, replaceItems, router, setSharedCartContext, sharedContext, token]);

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
        <Link
          href="/cart"
          aria-disabled={isLoading}
          className={[
            "inline-flex h-12 items-center justify-center rounded-full px-6 text-[15px] font-semibold text-white transition",
            isLoading ? "pointer-events-none bg-[#ffb27a]" : "bg-[#ff6a00] hover:bg-[#e55e00]",
          ].join(" ")}
        >
          Voir le panier importé
        </Link>
        <Link
          href="/checkout"
          aria-disabled={isLoading || !isImported}
          className={[
            "inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-[15px] font-semibold transition",
            (isLoading || !isImported)
              ? "pointer-events-none border border-[#e4e7ec] text-[#98a2b3]"
              : "border border-[#d9dfe8] text-[#344054] hover:border-[#ff6a00] hover:text-[#ff6a00]",
          ].join(" ")}
        >
          <Share2 className="h-4 w-4" />
          Aller au checkout
        </Link>
      </div>
    </section>
  );
}
