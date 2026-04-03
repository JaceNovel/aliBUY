import Image from "next/image";
import Link from "next/link";
import { SourcingCheckoutClient } from "@/components/sourcing-checkout-client";
import { getUserAddresses } from "@/lib/customer-data-store";
import { getPricingContext } from "@/lib/pricing";
import { SITE_LOGO_PATH, SITE_NAME } from "@/lib/site-config";
import { getCurrentUser } from "@/lib/user-auth";
import { redirect } from "next/navigation";

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ promo?: string }>;
}) {
  const pricing = await getPricingContext();
  const resolvedSearchParams = await searchParams;
  const promoCode = typeof resolvedSearchParams.promo === "string" ? resolvedSearchParams.promo.trim().toUpperCase() : "";
  const nextPath = promoCode ? `/checkout?promo=${encodeURIComponent(promoCode)}` : "/checkout";
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  const addresses = await getUserAddresses(user.id);

  return (
    <main className="min-h-screen bg-[#f5f5f5] text-[#191919]">
      <header className="border-b border-[#e5e5e5] bg-white">
        <div className="mx-auto flex max-w-[1440px] items-center gap-4 px-4 py-4 sm:px-6 xl:px-8">
          <Link href="/" className="inline-flex items-center gap-3">
            <Image src={SITE_LOGO_PATH} alt={`${SITE_NAME} logo`} width={44} height={44} className="h-11 w-11 object-contain" priority />
            <span className="text-[28px] font-bold tracking-[-0.06em] text-[#111827]">{SITE_NAME}</span>
          </Link>
          <div className="hidden h-7 w-px bg-[#e5e7eb] sm:block" />
          <div className="text-[22px] font-bold tracking-[-0.04em] text-[#111827]">Veuillez confirmer votre commande</div>
        </div>
      </header>

      <div className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6 sm:py-6 xl:px-8 xl:py-8">
        <SourcingCheckoutClient
          initialUser={{ displayName: user.displayName, email: user.email }}
          savedAddresses={addresses}
          initialCountryCode={pricing.countryCode}
          currencyCode={pricing.currency.code}
          locale={pricing.locale}
          initialPromoCode={promoCode}
        />
      </div>
    </main>
  );
}
