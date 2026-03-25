import Image from "next/image";
import Link from "next/link";

import { CartPageClient } from "@/components/cart-page-client";
import { InternalPageShell } from "@/components/internal-page-shell";
import { getPricingContext } from "@/lib/pricing";

export default async function CartPage() {
  const pricing = await getPricingContext();

  return (
    <InternalPageShell pricing={pricing}>
      <CartPageClient currencyCode={pricing.currency.code} locale={pricing.locale} />
      <div className="hidden">
        <Image src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="" width={1} height={1} />
      </div>
      <Link href="/orders" className="hidden">orders</Link>
    </InternalPageShell>
  );
}