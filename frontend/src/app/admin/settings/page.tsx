import { LockKeyhole, Search, ShieldCheck, Users } from "lucide-react";
import { redirect } from "next/navigation";

import { getAdminUsersOverview } from "@/lib/admin-data";
import { getAdminAccessRecords } from "@/lib/admin-access-store";
import { hasAdminPermission } from "@/lib/admin-auth";
import { AdminAccessSettingsClient } from "@/components/admin-access-settings-client";

export default async function AdminSettingsPage() {
  if (!(await hasAdminPermission("admin.manage"))) {
    redirect("/admin");
  }

  const users = await getAdminUsersOverview();
  const accessRecords = await getAdminAccessRecords();
  const activeUsers = users.filter((user) => user.status === "Actif").length;

  return (
    <div className="space-y-5">
      <section>
        <h1 className="text-[28px] font-black tracking-[-0.05em] text-[#101828]">Accès admin et comptes</h1>
        <p className="mt-1 text-[14px] text-[#667085]">Vue réelle des comptes inscrits et de la sécurité d’accès administration.</p>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        {[
          { title: "Comptes inscrits", value: String(users.length), description: "Tous les utilisateurs réellement enregistrés sur le projet.", icon: Users },
          { title: "Comptes actifs", value: String(activeUsers), description: "Utilisateurs avec activité commerciale ou support.", icon: ShieldCheck },
          { title: "Accès admin", value: String(accessRecords.length + 1), description: "Comptes admin déclarés, superadmin inclus.", icon: LockKeyhole },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <article key={card.title} className="rounded-[18px] border border-[#e7ebf1] bg-white px-6 py-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-[14px] bg-[#fff1e8] text-[#ff6a00]"><Icon className="h-5 w-5" /></div>
              <h2 className="mt-4 text-[24px] font-black tracking-[-0.04em] text-[#101828]">{card.value}</h2>
              <div className="mt-1 text-[15px] font-semibold text-[#101828]">{card.title}</div>
              <p className="mt-2 text-[14px] text-[#667085]">{card.description}</p>
            </article>
          );
        })}
      </section>

      <AdminAccessSettingsClient initialRecords={accessRecords} />

      <section className="rounded-[18px] border border-[#e7ebf1] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
        <div className="mb-5 text-[18px] font-black text-[#101828]">Utilisateurs</div>

        <div className="grid gap-3 lg:grid-cols-[1fr_180px_180px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98a2b3]" />
            <input placeholder="Rechercher des utilisateurs..." className="h-11 w-full rounded-[12px] border border-[#e4e7ec] pl-11 pr-4 text-[14px] outline-none focus:border-[#f84557]" />
          </div>
          <select className="h-11 rounded-[12px] border border-[#e4e7ec] px-4 text-[14px] outline-none focus:border-[#f84557]">
              <option>Tous les comptes</option>
          </select>
          <select className="h-11 rounded-[12px] border border-[#e4e7ec] px-4 text-[14px] outline-none focus:border-[#f84557]">
            <option>Tous les statuts</option>
          </select>
        </div>

        <div className="mt-5 overflow-x-auto rounded-[14px] border border-[#edf1f6]">
          <table className="min-w-full text-left">
            <thead className="bg-[#fbfcfe] text-[12px] uppercase tracking-[0.08em] text-[#667085]">
              <tr>
                <th className="px-4 py-3 font-semibold">Nom</th>
                <th className="px-4 py-3 font-semibold">Statut</th>
                <th className="px-4 py-3 font-semibold">Commandes</th>
                <th className="px-4 py-3 font-semibold">Support</th>
                <th className="px-4 py-3 text-right font-semibold">Inscription</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.email} className="border-t border-[#edf1f6] text-[14px] text-[#101828]">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f5f7fb] font-semibold text-[#101828]">{user.displayName.charAt(0)}</span>
                      <div>
                        <div className="font-semibold">{user.displayName}</div>
                        <div className="text-[13px] text-[#667085]">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className={[
                      "inline-flex rounded-full px-3 py-1 text-[12px] font-semibold",
                      user.status === "Actif" ? "bg-[#dcfae6] text-[#16a34a]" : "bg-[#eef2f6] text-[#475467]",
                    ].join(" ")}>{user.status}</span>
                  </td>
                  <td className="px-4 py-4">{user.ordersCount}</td>
                  <td className="px-4 py-4">{user.conversationsCount}</td>
                  <td className="px-4 py-4 text-right">{new Date(user.createdAt).toLocaleDateString("fr-FR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}