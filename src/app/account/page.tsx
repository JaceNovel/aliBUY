import Image from "next/image";
import Link from "next/link";
import { Camera, ChevronRight } from "lucide-react";
import { redirect } from "next/navigation";

import { accountCards } from "@/app/account/compte/account-links";
import { CopyUserIdButton } from "@/components/copy-user-id-button";
import { InternalPageShell } from "@/components/internal-page-shell";
import { UserLogoutButton } from "@/components/user-logout-button";
import { getAccountSettings } from "@/lib/account-settings-store";
import { getCurrentUser } from "@/lib/user-auth";
import { getPricingContext } from "@/lib/pricing";
import { getDisplayInitial, getMaskedEmail } from "@/lib/user-session";

const mobileProfileLinks = [
  { label: "Profil", href: "/account" },
  { label: "Adresses", href: "/account/addresses" },
  { label: "Commandes", href: "/orders" },
  { label: "Messages", href: "/messages" },
  { label: "Demandes de devis", href: "/quotes" },
  { label: "Favoris", href: "/favorites" },
  { label: "Compte", href: "/account/compte" },
];

export default async function AccountPage() {
  const pricing = await getPricingContext();
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?next=/account");
  }

  const displayInitial = getDisplayInitial(user.displayName).toLowerCase();
  const maskedEmail = getMaskedEmail(user.email);
  const settings = await getAccountSettings(user.id);

  return (
    <InternalPageShell pricing={pricing}>
      <section className="overflow-hidden rounded-[28px] bg-white shadow-[0_8px_30px_rgba(24,39,75,0.05)] ring-1 ring-black/5 sm:hidden">
        <div className="border-b border-[#ececec] px-5 py-5">
          <div className="flex items-center gap-4">
            <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-[#ffe8dc] text-[30px] font-semibold text-[#ff6a00]">
              {settings.profilePhotoUrl ? <Image src={settings.profilePhotoUrl} alt={user.displayName} fill className="object-cover" /> : displayInitial}
              <Link href="/account/compte/mon-profil" className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full border border-[#e8e8e8] bg-white text-[#777] transition hover:text-[#ff6a00]">
                <Camera className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="min-w-0">
              <h1 className="text-[24px] font-semibold tracking-[-0.04em] text-[#222]">{user.displayName}</h1>
              <p className="mt-1 text-[13px] text-[#666]">{maskedEmail}</p>
            </div>
          </div>
        </div>

        <div className="px-5 py-2">
          {mobileProfileLinks.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="flex items-center justify-between py-5 text-[17px] text-[#111]"
            >
              <span>{item.label}</span>
              <ChevronRight className="h-4 w-4 text-[#9b9b9b]" />
            </Link>
          ))}
        </div>

        <div className="border-t border-[#ececec] px-5 py-6">
          <UserLogoutButton className="text-[16px] font-medium text-[#111]">
            Se deconnecter
          </UserLogoutButton>
        </div>
      </section>

      <section className="hidden rounded-[32px] bg-white px-5 py-6 shadow-[0_8px_30px_rgba(24,39,75,0.05)] ring-1 ring-black/5 sm:block sm:px-10 sm:py-10">
        <div className="flex flex-col gap-8 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex flex-col items-start gap-5 sm:flex-row sm:gap-8">
            <div className="relative flex h-[104px] w-[104px] items-center justify-center overflow-hidden rounded-full bg-[#ffe8dc] text-[52px] font-semibold text-[#ff6a00] sm:h-[132px] sm:w-[132px] sm:text-[68px]">
              {settings.profilePhotoUrl ? <Image src={settings.profilePhotoUrl} alt={user.displayName} fill className="object-cover" /> : displayInitial}
              <Link href="/account/compte/mon-profil" className="absolute bottom-2 right-1 flex h-9 w-9 items-center justify-center rounded-full border border-[#e8e8e8] bg-white text-[#777] transition hover:text-[#ff6a00]">
                <Camera className="h-4 w-4" />
              </Link>
            </div>
            <div>
              <h1 className="text-[30px] font-bold tracking-[-0.05em] text-[#222] sm:text-[44px]">{user.displayName}</h1>
              <div className="mt-4 space-y-3 text-[15px] text-[#555] sm:text-[18px]">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                  <span className="min-w-28 text-[#666]">E-mail</span>
                  <span>{maskedEmail}</span>
                </div>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                  <span className="min-w-28 text-[#666]">Identifiant de membre</span>
                  <span>{user.id}</span>
                  <CopyUserIdButton value={user.id} />
                </div>
              </div>
            </div>
          </div>

          <div className="flex w-full flex-col gap-3 pt-2 sm:w-auto sm:flex-row sm:items-center sm:gap-6">
            <Link href="/account/compte/mon-profil" className="inline-flex h-12 items-center justify-center rounded-full bg-[#222] px-8 text-[15px] font-semibold text-white transition hover:bg-black sm:h-14 sm:text-[18px]">
              Modifier mon profil
            </Link>
            <UserLogoutButton className="text-left text-[15px] font-semibold text-[#222] transition hover:text-[#ff6a00] sm:text-[18px]">Se deconnecter</UserLogoutButton>
          </div>
        </div>

        <div className="mt-10 grid gap-6 xl:grid-cols-2">
          {accountCards.map((section) => {
            const Icon = section.icon;

            return (
              <article key={section.title} className="rounded-[26px] bg-[#fafafa] px-8 py-7 ring-1 ring-black/5">
                <div className="flex items-center gap-3 border-b border-[#e8e8e8] pb-5 text-[18px] font-semibold text-[#222]">
                  <Icon className="h-6 w-6" />
                  {section.title}
                </div>
                <div className="space-y-5 pt-6 text-[18px] text-[#333]">
                  {section.items.map((item) => (
                    <Link key={item.slug} href={`/account/compte/${item.slug}`} className="flex items-center justify-between rounded-[16px] px-2 py-2 transition hover:bg-white hover:text-[#ff6a00]">
                      <span>{item.label}</span>
                      <ChevronRight className="h-5 w-5 text-[#777]" />
                    </Link>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </InternalPageShell>
  );
}