import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Heart, Mail, MapPin, MessageSquare, Package2, Quote, ShieldUser } from "lucide-react";

import { getAdminUserDetail } from "@/lib/admin-data";
import { hasAdminPermission } from "@/lib/admin-auth";
import { getAccountSettings } from "@/lib/account-settings-store";

type AdminUserDetail = NonNullable<Awaited<ReturnType<typeof getAdminUserDetail>>>;
type AdminUserAddress = AdminUserDetail["addresses"][number];
type AdminUserOrder = AdminUserDetail["orders"][number];
type AdminUserFavorite = AdminUserDetail["favorites"][number];
type AdminUserQuote = AdminUserDetail["quotes"][number];
type AdminUserConversation = AdminUserDetail["conversations"][number];

export default async function AdminUserDetailPage({ params }: { params: Promise<{ userId: string }> }) {
  if (!(await hasAdminPermission("users.read"))) {
    redirect("/admin");
  }

  const { userId } = await params;
  const detail = await getAdminUserDetail(userId);
  if (!detail) {
    notFound();
  }

  const settings = await getAccountSettings(userId);

  return (
    <div className="space-y-5">
      <section className="rounded-[20px] border border-[#e6eaf0] bg-white px-5 py-5 shadow-[0_8px_22px_rgba(17,24,39,0.05)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-4">
            {settings.profilePhotoUrl ? (
              <Image src={settings.profilePhotoUrl} alt={detail.user.displayName} width={72} height={72} className="h-[72px] w-[72px] rounded-full object-cover" />
            ) : (
              <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[#ffe8dc] text-[28px] font-black text-[#ff6a00]">
                {detail.user.displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#ff6a5b]">Fiche utilisateur</div>
              <h1 className="mt-2 text-[30px] font-black tracking-[-0.05em] text-[#1f2937]">{detail.user.displayName}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-[14px] text-[#667085]">
                <span className="inline-flex items-center gap-2"><Mail className="h-4 w-4" />{detail.user.email}</span>
                <span className="inline-flex items-center gap-2"><ShieldUser className="h-4 w-4" />ID: {detail.user.id}</span>
              </div>
            </div>
          </div>
          <Link href="/admin/users" className="inline-flex h-11 items-center justify-center rounded-full border border-[#d0d5dd] px-5 text-[14px] font-semibold text-[#344054] transition hover:border-[#ff6a00] hover:text-[#ff6a00]">
            Retour aux utilisateurs
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Commandes", value: String(detail.orders.length), icon: Package2 },
          { label: "Devis", value: String(detail.quotes.length), icon: Quote },
          { label: "Conversations", value: String(detail.conversations.length), icon: MessageSquare },
          { label: "Favoris", value: String(detail.favorites.length), icon: Heart },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <article key={card.label} className="rounded-[18px] border border-[#e6eaf0] bg-white px-5 py-5 shadow-[0_8px_22px_rgba(17,24,39,0.05)]">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-[14px] bg-[#fff1e8] text-[#ff6a00]"><Icon className="h-5 w-5" /></div>
              <div className="mt-4 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">{card.label}</div>
              <div className="mt-1 text-[24px] font-black tracking-[-0.05em] text-[#1f2937]">{card.value}</div>
            </article>
          );
        })}
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <article className="rounded-[20px] border border-[#e6eaf0] bg-white p-5 shadow-[0_8px_22px_rgba(17,24,39,0.05)]">
          <div className="text-[18px] font-bold text-[#1f2937]">Adresses</div>
          <div className="mt-4 space-y-3">
            {detail.addresses.length ? detail.addresses.map((address: AdminUserAddress) => (
              <div key={address.id} className="rounded-[16px] border border-[#edf1f6] px-4 py-4 text-[14px] text-[#344054]">
                <div className="font-semibold text-[#101828]">{address.recipientName}</div>
                <div className="mt-1 inline-flex items-center gap-2 text-[#667085]"><MapPin className="h-4 w-4" />{address.addressLine1}</div>
                <div className="mt-1 text-[#667085]">{[address.city, address.state, address.countryCode].filter(Boolean).join(", ")}</div>
                <div className="mt-1 text-[#667085]">{address.phone}</div>
              </div>
            )) : <div className="rounded-[16px] bg-[#fbfcfe] px-4 py-4 text-[14px] text-[#667085]">Aucune adresse enregistrée.</div>}
          </div>
        </article>

        <article className="rounded-[20px] border border-[#e6eaf0] bg-white p-5 shadow-[0_8px_22px_rgba(17,24,39,0.05)]">
          <div className="text-[18px] font-bold text-[#1f2937]">Préférences profil</div>
          <div className="mt-4 grid gap-3 text-[14px] text-[#344054]">
            <div className="rounded-[16px] border border-[#edf1f6] px-4 py-3"><span className="font-semibold text-[#101828]">Bio:</span> {settings.bio || "Non renseignée"}</div>
            <div className="rounded-[16px] border border-[#edf1f6] px-4 py-3"><span className="font-semibold text-[#101828]">Entreprise:</span> {settings.companyName || "Non renseignée"}</div>
            <div className="rounded-[16px] border border-[#edf1f6] px-4 py-3"><span className="font-semibold text-[#101828]">Téléphone:</span> {settings.phone || "Non renseigné"}</div>
            <div className="rounded-[16px] border border-[#edf1f6] px-4 py-3"><span className="font-semibold text-[#101828]">Mise à jour:</span> {new Date(settings.updatedAt).toLocaleString("fr-FR")}</div>
          </div>
        </article>

        <article className="rounded-[20px] border border-[#e6eaf0] bg-white p-5 shadow-[0_8px_22px_rgba(17,24,39,0.05)]">
          <div className="text-[18px] font-bold text-[#1f2937]">Commandes</div>
          <div className="mt-4 space-y-3">
            {detail.orders.length ? detail.orders.map((order: AdminUserOrder) => (
              <div key={order.id} className="rounded-[16px] border border-[#edf1f6] px-4 py-4 text-[14px] text-[#344054]">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-semibold text-[#101828]">{order.id}</div>
                  <span className="rounded-full bg-[#eef2f6] px-3 py-1 text-[12px] font-semibold text-[#475467]">{order.status}</span>
                </div>
                <div className="mt-2 text-[#667085]">Montant: {order.totalPriceFcfa.toLocaleString("fr-FR")} FCFA</div>
                <div className="mt-1 text-[#667085]">Créée le {new Date(order.createdAt).toLocaleString("fr-FR")}</div>
              </div>
            )) : <div className="rounded-[16px] bg-[#fbfcfe] px-4 py-4 text-[14px] text-[#667085]">Aucune commande trouvée.</div>}
          </div>
        </article>

        <article className="rounded-[20px] border border-[#e6eaf0] bg-white p-5 shadow-[0_8px_22px_rgba(17,24,39,0.05)]">
          <div className="text-[18px] font-bold text-[#1f2937]">Favoris</div>
          <div className="mt-4 space-y-3">
            {detail.favorites.length ? detail.favorites.map((favorite: AdminUserFavorite) => (
              <div key={favorite.slug} className="rounded-[16px] border border-[#edf1f6] px-4 py-4 text-[14px] text-[#344054]">
                <div className="font-semibold text-[#101828]">{favorite.title}</div>
                <div className="mt-1 text-[#667085]">{favorite.slug}</div>
              </div>
            )) : <div className="rounded-[16px] bg-[#fbfcfe] px-4 py-4 text-[14px] text-[#667085]">Aucun favori enregistré.</div>}
          </div>
        </article>

        <article className="rounded-[20px] border border-[#e6eaf0] bg-white p-5 shadow-[0_8px_22px_rgba(17,24,39,0.05)]">
          <div className="text-[18px] font-bold text-[#1f2937]">Devis et support</div>
          <div className="mt-4 space-y-4">
            <div>
              <div className="mb-2 text-[15px] font-semibold text-[#101828]">Demandes de devis</div>
              <div className="space-y-3">
                {detail.quotes.length ? detail.quotes.map((quote: AdminUserQuote) => (
                  <div key={quote.id} className="rounded-[16px] border border-[#edf1f6] px-4 py-4 text-[14px] text-[#344054]">
                    <div className="font-semibold text-[#101828]">{quote.productName}</div>
                    <div className="mt-1 text-[#667085]">Quantité: {quote.quantity}</div>
                    <div className="mt-1 text-[#667085]">Soumis le {new Date(quote.createdAt).toLocaleString("fr-FR")}</div>
                  </div>
                )) : <div className="rounded-[16px] bg-[#fbfcfe] px-4 py-4 text-[14px] text-[#667085]">Aucun devis trouvé.</div>}
              </div>
            </div>
            <div>
              <div className="mb-2 text-[15px] font-semibold text-[#101828]">Conversations support</div>
              <div className="space-y-3">
                {detail.conversations.length ? detail.conversations.map((conversation: AdminUserConversation) => (
                  <div key={conversation.id} className="rounded-[16px] border border-[#edf1f6] px-4 py-4 text-[14px] text-[#344054]">
                    <div className="font-semibold text-[#101828]">{conversation.name}</div>
                    <div className="mt-1 text-[#667085]">{conversation.preview}</div>
                    <div className="mt-1 text-[#667085]">Statut: {conversation.status}</div>
                    <div className="mt-1 text-[#667085]">Mise à jour: {new Date(conversation.updatedAt).toLocaleString("fr-FR")}</div>
                  </div>
                )) : <div className="rounded-[16px] bg-[#fbfcfe] px-4 py-4 text-[14px] text-[#667085]">Aucune conversation trouvée.</div>}
              </div>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}