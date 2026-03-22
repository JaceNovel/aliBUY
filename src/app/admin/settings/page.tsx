import { Search } from "lucide-react";

import { getAdminSuppliers } from "@/lib/admin-data";

const roleCards = [
  {
    title: "Administrateur",
    description: "Accès complet à toutes les fonctionnalités",
    permissions: [
      "Gestion des utilisateurs: read, write, delete",
      "Autorité des produits: read, write, delete",
      "Configurations système: read, write, delete",
      "Gestion des fichiers: read, write, delete",
      "Rapports: read, write, delete",
    ],
    members: ["J", "K"],
  },
  {
    title: "Manager",
    description: "Gestion des produits et commandes",
    permissions: [
      "Autorité des produits: read, write",
      "Gestion des commandes: read, write",
      "Rapports: read",
    ],
    members: [],
  },
  {
    title: "Éditeur",
    description: "Gestion du contenu et des articles",
    permissions: [
      "Gestion du contenu: read, write",
      "Gestion des fichiers: read, write",
    ],
    members: [],
  },
];

export default function AdminSettingsPage() {
  const users = getAdminSuppliers().slice(0, 5).map((supplier, index) => ({
    name: supplier.name.split(" ").slice(0, 2).join(" "),
    email: `${supplier.name.toLowerCase().replace(/[^a-z]+/g, ".").replace(/^\.|\.$/g, "")}@gmail.com`,
    status: index % 2 === 0 ? "Actif" : "En attente",
    role: index === 0 ? "admin" : index === 1 ? "manager" : "user",
    lastLogin: index === 0 ? "Jamais connecté" : "Aujourd'hui",
  }));

  return (
    <div className="space-y-5">
      <section>
        <h1 className="text-[28px] font-black tracking-[-0.05em] text-[#101828]">Rôles & Permissions</h1>
        <p className="mt-1 text-[14px] text-[#667085]">Gérez les rôles et les permissions des utilisateurs</p>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        {roleCards.map((card) => (
          <article key={card.title} className="rounded-[18px] border border-[#e7ebf1] bg-white px-6 py-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
            <h2 className="text-[24px] font-black tracking-[-0.04em] text-[#101828]">{card.title}</h2>
            <p className="text-[14px] text-[#667085]">{card.description}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {card.permissions.map((permission) => (
                <span key={permission} className="rounded-full bg-[#f5f7fb] px-3 py-1 text-[12px] font-semibold text-[#101828]">{permission}</span>
              ))}
            </div>
            <div className="mt-6 flex gap-2">
              {card.members.map((member) => (
                <span key={member} className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f5f7fb] text-[14px] font-semibold text-[#101828]">{member}</span>
              ))}
            </div>
          </article>
        ))}
      </section>

      <section className="rounded-[18px] border border-[#e7ebf1] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
        <div className="mb-5 text-[18px] font-black text-[#101828]">Utilisateurs</div>

        <div className="grid gap-3 lg:grid-cols-[1fr_180px_180px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98a2b3]" />
            <input placeholder="Rechercher des utilisateurs..." className="h-11 w-full rounded-[12px] border border-[#e4e7ec] pl-11 pr-4 text-[14px] outline-none focus:border-[#f84557]" />
          </div>
          <select className="h-11 rounded-[12px] border border-[#e4e7ec] px-4 text-[14px] outline-none focus:border-[#f84557]">
            <option>Tous les rôles</option>
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
                <th className="px-4 py-3 font-semibold">Rôle</th>
                <th className="px-4 py-3 font-semibold">Dernière connexion</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.email} className="border-t border-[#edf1f6] text-[14px] text-[#101828]">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f5f7fb] font-semibold text-[#101828]">{user.name.charAt(0)}</span>
                      <div>
                        <div className="font-semibold">{user.name}</div>
                        <div className="text-[13px] text-[#667085]">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className={[
                      "inline-flex rounded-full px-3 py-1 text-[12px] font-semibold",
                      user.status === "Actif" ? "bg-[#dcfae6] text-[#16a34a]" : "bg-[#fff4db] text-[#d97706]",
                    ].join(" ")}>{user.status}</span>
                  </td>
                  <td className="px-4 py-4">
                    <select defaultValue={user.role} className="h-10 rounded-[10px] border border-[#e4e7ec] px-3 text-[14px] outline-none focus:border-[#f84557]">
                      <option value="admin">admin</option>
                      <option value="manager">manager</option>
                      <option value="user">user</option>
                    </select>
                  </td>
                  <td className="px-4 py-4">{user.lastLogin}</td>
                  <td className="px-4 py-4 text-right">
                    <button type="button" className="rounded-[10px] bg-[#f84557] px-4 py-2 text-[14px] font-semibold text-white transition hover:bg-[#ea3248]">
                      Bloquer
                    </button>
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