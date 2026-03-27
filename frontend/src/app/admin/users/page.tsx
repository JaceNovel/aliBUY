import Link from "next/link";
import { MessagesSquare, Package2, Quote, Users } from "lucide-react";
import { redirect } from "next/navigation";

import { getAdminUsersOverview } from "@/lib/admin-data";
import { hasAdminPermission } from "@/lib/admin-auth";

export default async function AdminUsersPage() {
  if (!(await hasAdminPermission("users.read"))) {
    redirect("/admin");
  }

  const users = await getAdminUsersOverview();
  const activeUsers = users.filter((user) => user.status === "Actif").length;
  const usersWithOrders = users.filter((user) => user.ordersCount > 0).length;
  const usersWithSupport = users.filter((user) => user.conversationsCount > 0).length;

  return (
    <div className="space-y-5">
      <section className="rounded-[20px] border border-[#e6eaf0] bg-white px-5 py-5 shadow-[0_8px_22px_rgba(17,24,39,0.05)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#ff6a5b]">Administration</div>
            <h1 className="mt-2 text-[30px] font-black tracking-[-0.05em] text-[#1f2937]">Utilisateurs inscrits</h1>
            <p className="mt-2 max-w-[760px] text-[14px] leading-6 text-[#667085]">Cette vue regroupe tous les comptes réellement enregistrés sur le projet avec leurs commandes, demandes de devis et conversations support.</p>
          </div>
          <div className="rounded-[14px] bg-[#fff2ed] px-4 py-3 text-[13px] font-semibold text-[#ff6a5b]">{users.length} comptes</div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          { label: "Comptes actifs", value: String(activeUsers), icon: Users },
          { label: "Avec commandes", value: String(usersWithOrders), icon: Package2 },
          { label: "Avec support", value: String(usersWithSupport), icon: MessagesSquare },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <article key={card.label} className="rounded-[18px] border border-[#e6eaf0] bg-white px-5 py-5 shadow-[0_8px_22px_rgba(17,24,39,0.05)]">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-[14px] bg-[#fff1e8] text-[#ff6a00]">
                <Icon className="h-5 w-5" />
              </div>
              <div className="mt-4 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">{card.label}</div>
              <div className="mt-1 text-[24px] font-black tracking-[-0.05em] text-[#1f2937]">{card.value}</div>
            </article>
          );
        })}
      </section>

      <section className="overflow-hidden rounded-[20px] border border-[#e6eaf0] bg-white shadow-[0_8px_22px_rgba(17,24,39,0.05)]">
        <div className="border-b border-[#edf1f6] px-5 py-4 text-[18px] font-bold text-[#1f2937]">Liste complète</div>
        <div className="overflow-x-auto px-5 py-3">
          <table className="min-w-full text-left">
            <thead>
              <tr className="text-[12px] uppercase tracking-[0.08em] text-[#98a2b3]">
                <th className="py-3 pr-4 font-semibold">Utilisateur</th>
                <th className="py-3 pr-4 font-semibold">Statut</th>
                <th className="py-3 pr-4 font-semibold">Commandes</th>
                <th className="py-3 pr-4 font-semibold">Devis</th>
                <th className="py-3 pr-4 font-semibold">Support</th>
                <th className="py-3 pr-4 font-semibold">Inscription</th>
                <th className="py-3 pr-4 font-semibold">Accès</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t border-[#edf1f6] text-[13px] text-[#1f2937]">
                  <td className="py-3.5 pr-4">
                    <div className="font-semibold">{user.displayName}</div>
                    <div className="text-[#667085]">{user.email}</div>
                  </td>
                  <td className="py-3.5 pr-4">
                    <span className={["inline-flex rounded-full px-3 py-1 text-[12px] font-semibold", user.status === "Actif" ? "bg-[#dcfae6] text-[#16a34a]" : "bg-[#eef2f6] text-[#475467]"].join(" ")}>{user.status}</span>
                  </td>
                  <td className="py-3.5 pr-4">{user.ordersCount}</td>
                  <td className="py-3.5 pr-4">{user.quotesCount}</td>
                  <td className="py-3.5 pr-4">{user.conversationsCount}</td>
                  <td className="py-3.5 pr-4">{new Date(user.createdAt).toLocaleDateString("fr-FR")}</td>
                  <td className="py-3.5 pr-4">
                    <div className="flex flex-wrap gap-2">
                      <Link href={`/admin/users/${user.id}`} className="inline-flex items-center gap-1 rounded-full border border-[#e4e7ec] px-3 py-1.5 text-[12px] font-semibold text-[#344054] transition hover:border-[#ff6a00] hover:text-[#ff6a00]">
                        <Package2 className="h-3.5 w-3.5" />
                        Fiche complète
                      </Link>
                      <Link href={`/admin/users/${user.id}`} className="inline-flex items-center gap-1 rounded-full border border-[#e4e7ec] px-3 py-1.5 text-[12px] font-semibold text-[#344054] transition hover:border-[#ff6a00] hover:text-[#ff6a00]">
                        <Quote className="h-3.5 w-3.5" />
                        Activité
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}