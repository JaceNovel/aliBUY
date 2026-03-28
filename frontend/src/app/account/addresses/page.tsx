import Link from "next/link";
import { MapPinned } from "lucide-react";
import { redirect } from "next/navigation";

import { AccountAddressBookClient } from "@/components/account-address-book-client";
import { InternalPageShell } from "@/components/internal-page-shell";
import { getUserAddresses } from "@/lib/customer-data-store";
import { getPricingContext } from "@/lib/pricing";
import { getCurrentUser } from "@/lib/user-auth";

export default async function AccountAddressesPage() {
  const pricing = await getPricingContext();
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?next=/account/addresses");
  }

  const addresses = await getUserAddresses(user.id);

  return (
    <InternalPageShell pricing={pricing}>
      <div className="space-y-5 sm:space-y-8">
        <div className="flex flex-wrap items-center gap-2 text-[12px] text-[#7b675a] sm:text-[13px]">
          <Link href="/account" className="transition hover:text-[#ff6a00]">Profil</Link>
          <span>/</span>
          <span className="font-semibold text-[#221f1c]">Adresses</span>
        </div>

        <section className="overflow-hidden rounded-[28px] bg-white shadow-[0_10px_30px_rgba(24,39,75,0.05)] ring-1 ring-black/5 sm:rounded-[32px]">
          <div className="border-b border-[#ececec] px-5 py-5 sm:px-8 sm:py-7">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#fff2e9] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#d85300] sm:px-4 sm:py-2 sm:text-[13px] sm:tracking-[0.16em]">
              <MapPinned className="h-4 w-4" />
              Carnet d&apos;adresses
            </div>
            <h1 className="mt-3 text-[26px] font-bold tracking-[-0.05em] text-[#222] sm:mt-4 sm:text-[42px]">Gérer vos adresses de livraison</h1>
            <p className="mt-2 max-w-[760px] text-[14px] leading-6 text-[#666] sm:text-[16px] sm:leading-8">
              Enregistrez plusieurs adresses, choisissez votre adresse par défaut et réutilisez-les rapidement pendant le checkout.
            </p>
          </div>

          <div className="px-4 py-4 sm:px-8 sm:py-8">
            <AccountAddressBookClient initialAddresses={addresses} />
          </div>
        </section>
      </div>
    </InternalPageShell>
  );
}