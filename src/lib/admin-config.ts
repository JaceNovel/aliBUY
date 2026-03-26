export type AdminSectionSlug =
  | "users"
  | "orders"
  | "products"
  | "categories"
  | "promotions"
  | "promo-codes"
  | "offers"
  | "free-deals"
  | "email"
  | "support"
  | "imports"
  | "alibaba-sourcing"
  | "reviews"
  | "settings";

export type AdminNavItem = {
  slug: AdminSectionSlug;
  label: string;
  icon: string;
  description: string;
  href: string;
  publicHref?: string;
};

export type AdminNavSubItem = {
  label: string;
  href: string;
};

export const adminNavItems: AdminNavItem[] = [
  { slug: "users", label: "Utilisateurs", icon: "users", description: "Tous les utilisateurs inscrits avec leur activité réelle sur le projet.", href: "/admin/users", publicHref: "/account" },
  { slug: "orders", label: "Commandes", icon: "shopping-cart", description: "Toutes les commandes clients avec livraison, paiement et detail des articles.", href: "/admin/orders", publicHref: "/orders" },
  { slug: "products", label: "Produits", icon: "package", description: "Catalogue produit et fiches detail.", href: "/admin/products", publicHref: "/products" },
  { slug: "categories", label: "Categories", icon: "list", description: "Taxonomie de navigation et familles produit.", href: "/admin/categories", publicHref: "/products" },
  { slug: "promotions", label: "Promotions", icon: "badge-percent", description: "Promos hero, badges et campagnes mode.", href: "/admin/promotions", publicHref: "/mode" },
  { slug: "promo-codes", label: "Codes Promo", icon: "ticket-percent", description: "Codes de reduction et activations marketing.", href: "/admin/promo-codes", publicHref: "/mode" },
  { slug: "offers", label: "Offres", icon: "gift", description: "Offres chaudes visibles en home et mode.", href: "/admin/offers", publicHref: "/trends" },
  { slug: "free-deals", label: "Produits gratuits", icon: "sparkles", description: "Campagne dediee a la page articles gratuits, imports Alibaba et regles de l'offre.", href: "/admin/free-deals", publicHref: "/articles-gratuits" },
  { slug: "email", label: "Email", icon: "mail", description: "Campagnes de relance et communication B2B.", href: "/admin/email", publicHref: "/messages" },
  { slug: "support", label: "Support Client", icon: "headset", description: "Tickets prioritaires et conversations agents.", href: "/admin/support", publicHref: "/messages" },
  { slug: "imports", label: "Demandes d'Importation", icon: "ship-wheel", description: "Dossiers d'import et suivi logistique.", href: "/admin/imports", publicHref: "/orders" },
  { slug: "alibaba-sourcing", label: "Alibaba Sourcing", icon: "boxes", description: "Automatisation achat fournisseur, import produits Alibaba, prix finaux FCFA et groupage mer.", href: "/admin/alibaba-sourcing", publicHref: "/cart" },
  { slug: "reviews", label: "Avis Clients", icon: "star", description: "Qualite percue et retours terrain.", href: "/admin/reviews", publicHref: "/favorites" },
  { slug: "settings", label: "Parametres", icon: "settings", description: "Pays, devise, langue et regles operationnelles.", href: "/admin/settings", publicHref: "/pricing" },
];

export const adminQuickLinks = [
  { label: "Messages", href: "/messages", icon: "mail" },
  { label: "Commandes", href: "/orders", icon: "shopping-cart" },
  { label: "Devis", href: "/quotes", icon: "file-text" },
  { label: "Catalogue", href: "/products", icon: "package" },
];

export const adminNavSubItems: Partial<Record<AdminSectionSlug, AdminNavSubItem[]>> = {
  products: [
    { label: "Liste", href: "/admin/products" },
    { label: "Ajouter", href: "/admin/products/add" },
  ],
  "promo-codes": [
    { label: "Liste", href: "/admin/promo-codes" },
    { label: "Ajouter", href: "/admin/promo-codes/add" },
  ],
  offers: [
    { label: "Liste", href: "/admin/offers" },
    { label: "Ajouter", href: "/admin/offers/add" },
  ],
  settings: [
    { label: "Rôles & Permissions", href: "/admin/settings" },
    { label: "Site Web", href: "/admin/settings/site-web" },
  ],
  "alibaba-sourcing": [
    { label: "Tableau de bord", href: "/admin/alibaba-sourcing" },
    { label: "Comptes fournisseurs", href: "/admin/alibaba-sourcing/accounts" },
    { label: "Import catalogue", href: "/admin/alibaba-sourcing/import-catalog" },
    { label: "Pays", href: "/admin/alibaba-sourcing/countries" },
    { label: "Adresses reception", href: "/admin/alibaba-sourcing/addresses" },
    { label: "Mappings produit-source", href: "/admin/alibaba-sourcing/mappings" },
    { label: "Demandes", href: "/admin/alibaba-sourcing/requests" },
    { label: "Lots d'achat", href: "/admin/alibaba-sourcing/lots" },
    { label: "Receptions", href: "/admin/alibaba-sourcing/receptions" },
  ],
};

export function getAdminSectionMeta(slug: AdminSectionSlug) {
  return adminNavItems.find((item) => item.slug === slug) ?? null;
}
