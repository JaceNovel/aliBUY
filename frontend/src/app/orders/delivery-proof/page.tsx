import Image from "next/image";
import Link from "next/link";
import { CheckCheck, ImageIcon, ShieldCheck } from "lucide-react";

import { InternalPageShell } from "@/components/internal-page-shell";
import { getOrderTrackingHref } from "@/lib/orders-data";
import { getUserOrderRecordById } from "@/lib/order-service";
import { getPricingContext } from "@/lib/pricing";
import { getCurrentUser } from "@/lib/user-auth";
import { notFound, redirect } from "next/navigation";

export default async function DeliveryProofPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string }>;
}) {
  const pricing = await getPricingContext();
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?next=/orders/delivery-proof");
  }

  const resolvedSearchParams = await searchParams;
  const order = await getUserOrderRecordById(user, resolvedSearchParams.orderId);

  if (!order) {
    notFound();
  }

  return (
    <InternalPageShell pricing={pricing}>
      <div className="grid gap-4 pb-8 xl:grid-cols-[1.05fr_0.95fr] sm:gap-6 sm:pb-0">
        <section className="bg-transparent px-0 py-0 shadow-none ring-0 sm:rounded-[28px] sm:bg-white sm:px-7 sm:py-7 sm:shadow-[0_8px_30px_rgba(24,39,75,0.05)] sm:ring-1 sm:ring-black/5">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#edf8f1] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#127a46] sm:px-4 sm:py-2 sm:text-[12px] sm:tracking-[0.16em]">
            <CheckCheck className="h-4 w-4" />
            Preuve de livraison
          </div>
          <h1 className="mt-3 text-[22px] font-bold tracking-[-0.05em] text-[#222] sm:mt-4 sm:text-[40px]">Voir la preuve de livraison</h1>
          <p className="mt-2 max-w-[760px] text-[13px] leading-5 text-[#666] sm:text-[16px] sm:leading-8">
            Retrouvez l’archivage de remise et l’état final de la commande validée comme livrée.
          </p>

          <div className="mt-4 overflow-hidden rounded-[20px] bg-[#fafafa] ring-1 ring-black/5 sm:mt-6 sm:rounded-[24px]">
            <div className="relative aspect-[1.02] bg-[#f4f4f4] sm:aspect-[1.15]">
              <Image src={order.logistics.proofs?.[0]?.mediaUrl || order.image} alt={order.title} fill sizes="(min-width: 1280px) 42vw, 94vw" className="object-cover" />
              <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/92 px-2.5 py-1 text-[10px] font-semibold text-[#127a46] shadow-[0_10px_20px_rgba(0,0,0,0.08)] sm:left-4 sm:top-4 sm:gap-2 sm:px-3 sm:py-1.5 sm:text-[11px]">
                <ImageIcon className="h-4 w-4" />
                Archive de livraison
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2.5 sm:mt-6 sm:flex-row sm:gap-3">
            <Link href={getOrderTrackingHref(order)} className="inline-flex h-11 items-center justify-center rounded-full bg-[#222] px-5 text-[14px] font-semibold text-white transition hover:bg-black sm:h-12 sm:px-6 sm:text-[15px]">
              Revoir le suivi
            </Link>
            <Link href="/orders" className="inline-flex h-11 items-center justify-center rounded-full border border-[#222] px-5 text-[14px] font-semibold text-[#222] transition hover:border-[#ff6a00] hover:text-[#ff6a00] sm:h-12 sm:px-6 sm:text-[15px]">
              Retour aux commandes
            </Link>
          </div>
        </section>

        <aside className="bg-transparent px-0 py-0 shadow-none ring-0 sm:rounded-[28px] sm:bg-white sm:px-7 sm:py-7 sm:shadow-[0_8px_30px_rgba(24,39,75,0.05)] sm:ring-1 sm:ring-black/5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#7b7b7b] sm:text-[12px] sm:tracking-[0.12em]">Commande livrée</div>
          <div className="mt-1.5 break-all text-[14px] font-semibold text-[#222] sm:mt-2 sm:text-[15px]">{order.id}</div>
          <div className="mt-3 line-clamp-2 text-[15px] font-semibold leading-5 text-[#222] sm:mt-4 sm:text-[16px] sm:leading-6">{order.title}</div>

          <div className="mt-4 space-y-2.5 rounded-[18px] bg-[#fafafa] px-4 py-4 ring-1 ring-black/5 sm:mt-5 sm:space-y-3 sm:rounded-[20px]">
            <div>
              <div className="text-[12px] text-[#777]">Statut final</div>
              <div className="mt-1 text-[14px] font-semibold text-[#222] sm:text-[15px]">{order.status}</div>
            </div>
            <div>
              <div className="text-[12px] text-[#777]">Montant</div>
              <div className="mt-1 text-[14px] font-semibold text-[#222] sm:text-[15px]">{order.total}</div>
            </div>
            <div>
              <div className="text-[12px] text-[#777]">Dernière mise à jour</div>
              <div className="mt-1 text-[13px] leading-5 text-[#555] sm:text-[14px] sm:leading-6">{order.logistics.lastUpdate}</div>
            </div>
            {order.logistics.proofs?.[0] ? (
              <div>
                <div className="text-[12px] text-[#777]">Preuve</div>
                <div className="mt-1 text-[13px] leading-5 text-[#555] sm:text-[14px] sm:leading-6">{order.logistics.proofs[0].title}{order.logistics.proofs[0].note ? ` · ${order.logistics.proofs[0].note}` : ""}</div>
              </div>
            ) : null}
          </div>

          <div className="mt-4 rounded-[18px] bg-[#edf8f1] px-4 py-4 ring-1 ring-[#cfe7d7] sm:mt-5 sm:rounded-[20px]">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#127a46] sm:text-[12px] sm:tracking-[0.12em]">
              <ShieldCheck className="h-4 w-4" />
              Dossier archivé
            </div>
            <div className="mt-2 text-[13px] leading-5 text-[#2d5f3e] sm:text-[14px] sm:leading-6">
              La preuve de livraison a été enregistrée dans le dossier AfriPay et reste disponible pour vérification.
            </div>
          </div>
        </aside>
      </div>
    </InternalPageShell>
  );
}