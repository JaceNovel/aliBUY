import { catalogCategories } from "@/lib/catalog-taxonomy";
import { orders } from "@/lib/orders-data";
import { products } from "@/lib/products-data";

export type AdminSectionSlug =
  | "users"
  | "products"
  | "categories"
  | "promotions"
  | "promo-codes"
  | "offers"
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

export type AdminImportRequestStatus = "En attente" | "En traitement" | "Complété" | "Rejeté";

export type AdminImportRequest = {
  requestCode: string;
  orderId: string;
  clientName: string;
  email: string;
  phone: string;
  product: string;
  productUrl: string;
  productDescription: string;
  budget: string;
  additionalInfo: string;
  quantity: number;
  dateLabel: string;
  createdAt: string;
  updatedLabel: string;
  status: AdminImportRequestStatus;
  corridor: string;
  tracking: string;
  agent: string;
  href: string;
};

export const adminNavItems: AdminNavItem[] = [
  { slug: "users", label: "Utilisateurs", icon: "users", description: "Fournisseurs et comptes relies au catalogue.", href: "/admin/users", publicHref: "/account" },
  { slug: "products", label: "Produits", icon: "package", description: "Catalogue produit et fiches detail.", href: "/admin/products", publicHref: "/products" },
  { slug: "categories", label: "Categories", icon: "list", description: "Taxonomie de navigation et familles produit.", href: "/admin/categories", publicHref: "/categories/for-you" },
  { slug: "promotions", label: "Promotions", icon: "badge-percent", description: "Promos hero, badges et campagnes mode.", href: "/admin/promotions", publicHref: "/mode" },
  { slug: "promo-codes", label: "Codes Promo", icon: "ticket-percent", description: "Codes de reduction et activations marketing.", href: "/admin/promo-codes", publicHref: "/mode" },
  { slug: "offers", label: "Offres", icon: "gift", description: "Offres chaudes visibles en home et mode.", href: "/admin/offers", publicHref: "/trends" },
  { slug: "email", label: "Email", icon: "mail", description: "Campagnes de relance et communication B2B.", href: "/admin/email", publicHref: "/messages" },
  { slug: "support", label: "Support Client", icon: "headset", description: "Tickets prioritaires et conversations agents.", href: "/admin/support", publicHref: "/messages?tab=service" },
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
};

function parseUsdAmount(total: string) {
  const amount = Number(total.replace(/[^(0-9.)]/g, ""));
  return Number.isFinite(amount) ? amount : 0;
}

export function getAdminSuppliers() {
  const supplierMap = new Map<
    string,
    {
      name: string;
      location: string;
      yearsInBusiness: number;
      productCount: number;
      responseTime: string;
      status: string;
    }
  >();

  for (const product of products) {
    const existing = supplierMap.get(product.supplierName);

    if (existing) {
      existing.productCount += 1;
      continue;
    }

    supplierMap.set(product.supplierName, {
      name: product.supplierName,
      location: product.supplierLocation,
      yearsInBusiness: product.yearsInBusiness,
      productCount: 1,
      responseTime: product.responseTime,
      status: product.yearsInBusiness >= 6 ? "Verifie" : "A suivre",
    });
  }

  return Array.from(supplierMap.values()).sort((left, right) => right.productCount - left.productCount);
}

export function getAdminMetrics() {
  const suppliers = getAdminSuppliers();
  const revenueUsd = orders.reduce((sum, order) => sum + parseUsdAmount(order.total), 0);
  const promotionsCount = products.filter((product) => product.badge || product.title.toLowerCase().includes("promo")).length;
  const pendingOrdersCount = orders.filter((order) => order.status !== "Commande Livré").length;

  return {
    revenueUsd,
    ordersCount: orders.length,
    productsCount: products.length,
    suppliersCount: suppliers.length,
    categoriesCount: catalogCategories.length,
    promotionsCount,
    pendingOrdersCount,
  };
}

export function getAdminMonthlyRevenue() {
  const monthLabels = ["Jan", "Fev", "Mar", "Avr", "Mai", "Juin"];
  const revenueByMonth = new Map<number, number>();

  for (const order of orders) {
    const monthIndex = new Date(order.dateValue).getUTCMonth();
    revenueByMonth.set(monthIndex, (revenueByMonth.get(monthIndex) ?? 0) + parseUsdAmount(order.total));
  }

  return monthLabels.map((label, index) => ({
    label,
    value: revenueByMonth.get(index) ?? 0,
  }));
}

export function getAdminRecentOrders(limit = 5) {
  return [...orders]
    .sort((left, right) => right.dateValue.localeCompare(left.dateValue))
    .slice(0, limit)
    .map((order) => ({
      id: order.id.replace("#", ""),
      customer: order.seller,
      product: order.title,
      date: order.dateValue,
      totalUsd: parseUsdAmount(order.total),
      status: order.status,
      href: "/orders",
    }));
}

export function getAdminPromotions() {
  return products
    .filter((product) => product.badge || product.title.toLowerCase().includes("promo"))
    .map((product) => ({
      name: product.shortTitle,
      badge: product.badge ?? "Promo",
      priceMinUsd: product.minUsd,
      priceMaxUsd: product.maxUsd,
      href: `/products/${product.slug}`,
    }));
}

export const adminPromoCodes = [
  {
    code: "WELCOME10",
    type: "Pourcentage",
    value: "10%",
    minPurchase: "-",
    usages: "0 / 1",
    validity: "01/01/2026 - 31/12/2026",
    status: "Actif",
    channel: "Mode Hero",
    href: "/mode",
  },
  {
    code: "SUMMER25",
    type: "Pourcentage",
    value: "25%",
    minPurchase: "100€",
    usages: "12 / ∞",
    validity: "01/06/2026 - 31/08/2026",
    status: "Actif",
    channel: "Mode Choice",
    href: "/mode",
  },
  {
    code: "FREESHIP",
    type: "Livraison",
    value: "Gratuite",
    minPurchase: "50€",
    usages: "45 / ∞",
    validity: "01/01/2026 - 31/12/2026",
    status: "Actif",
    channel: "Panier",
    href: "/orders",
  },
];

export function getAdminOffers() {
  return products.slice(0, 8).map((product) => ({
    name: product.shortTitle,
    supplier: product.supplierName,
    moq: `${product.moq} ${product.unit}`,
    priceMinUsd: product.minUsd,
    category: product.slug.includes("gaming") ? "Gaming" : product.slug.includes("vr") ? "Immersif" : "Lifestyle",
    href: `/products/${product.slug}`,
  }));
}

export const adminEmailCampaigns = [
  { subject: "Relance panier produits gaming", segment: "Acheteurs high-intent", status: "Pret a envoyer", href: "/messages" },
  { subject: "Promotions mode et bundles Choice", segment: "Visiteurs Mode", status: "En brouillon", href: "/mode" },
  { subject: "Nouvelles categories a forte marge", segment: "Prospection B2B", status: "Programme", href: "/products" },
];

export function getAdminSupportTickets() {
  return orders.map((order) => ({
    subject: order.title,
    owner: order.logistics.agentName,
    priority: order.status === "Paiement en attente" ? "Haute" : order.status === "Livraison en attente" ? "Moyenne" : "Normale",
    status: order.status,
    href: "/messages",
  }));
}

export function getAdminImportRequests() {
  const requestOverrides = [
    {
      requestCode: "imp-001",
      phone: "+33 6 12 34 56 78",
      productUrl: "https://www.aliexpress.com/item/1005004424678989.html",
      productDescription: "Smartphone Android 6.7 pouces, 8GB RAM, 256GB stockage",
      budget: "300-400€",
      additionalInfo: "Je préfère la couleur noire ou bleue. Livraison urgente si possible.",
      createdAt: "15 novembre 2023 à 09:30",
      dateLabel: "15 novembre 2023",
      updatedLabel: "Mis à jour aujourd'hui à 08:45",
    },
    {
      requestCode: "imp-002",
      phone: "+225 07 08 12 34 56",
      productUrl: "https://www.aliexpress.com/item/1005006012450001.html",
      productDescription: "Kit panneaux solaires 5kW avec batterie lithium et onduleur hybride",
      budget: "2 500-3 200€",
      additionalInfo: "Installation prévue à Abidjan. Merci de proposer aussi les frais de transit.",
      createdAt: "08 janvier 2024 à 14:10",
      dateLabel: "08 janvier 2024",
      updatedLabel: "Mis à jour hier à 17:25",
    },
    {
      requestCode: "imp-003",
      phone: "+233 24 555 98 76",
      productUrl: "https://www.aliexpress.com/item/1005005100042003.html",
      productDescription: "Lot de fauteuils gaming ergonomiques avec logo personnalisé",
      budget: "1 800-2 100€",
      additionalInfo: "Besoin d'un devis FOB et CIF pour Accra.",
      createdAt: "22 février 2024 à 11:05",
      dateLabel: "22 février 2024",
      updatedLabel: "Mis à jour il y a 2 jours",
    },
    {
      requestCode: "imp-004",
      phone: "+228 90 11 22 33",
      productUrl: "https://www.aliexpress.com/item/1005005331030021.html",
      productDescription: "Équipements VR pour espace de loisirs indoor, pack 2 sièges",
      budget: "5 500-6 500€",
      additionalInfo: "Projet en attente de validation bancaire. Merci de conserver la proforma.",
      createdAt: "04 mars 2024 à 16:40",
      dateLabel: "04 mars 2024",
      updatedLabel: "Mis à jour la semaine dernière",
    },
    {
      requestCode: "imp-005",
      phone: "+229 97 44 10 22",
      productUrl: "https://www.aliexpress.com/item/1005004900004412.html",
      productDescription: "Combo clavier souris RGB et tapis pour revendeur informatique",
      budget: "700-950€",
      additionalInfo: "Merci d'indiquer le MOQ exact et le délai de production avant expédition.",
      createdAt: "17 avril 2024 à 10:20",
      dateLabel: "17 avril 2024",
      updatedLabel: "Mis à jour ce matin",
    },
  ] as const;

  return orders
    .slice(0, 5)
    .map((order, index) => {
      const quantityMatch = order.variant.match(/x\s*(\d+)/i);
      const quantity = quantityMatch ? Number(quantityMatch[1]) : 1;
      const clientName = ["Jean Dupont", "Marie Lambert", "Thomas Petit", "Lucie Martin", "Pierre Durand"][index] ?? order.seller;
      const email = `${clientName.toLowerCase().replace(/[^a-z]+/g, ".").replace(/^\.|\.$/g, "")}@example.com`;
      const uiStatus = ["En attente", "En traitement", "Complété", "Rejeté", "En traitement"][index] ?? "En attente";
      const override = requestOverrides[index];

      return {
        requestCode: override?.requestCode ?? `imp-00${index + 1}`,
        orderId: order.id,
        clientName,
        email,
        phone: override?.phone ?? "+33 6 00 00 00 00",
        product: order.title,
        productUrl: override?.productUrl ?? "https://www.aliexpress.com/",
        productDescription: override?.productDescription ?? order.title,
        budget: override?.budget ?? "Sur demande",
        additionalInfo: override?.additionalInfo ?? "Aucune information complémentaire fournie.",
        quantity,
        dateLabel: override?.dateLabel ?? "il y a plus d'un an",
        createdAt: override?.createdAt ?? "Date indisponible",
        updatedLabel: override?.updatedLabel ?? "Mis à jour il y a plus d'un an",
        status: uiStatus as AdminImportRequestStatus,
        corridor: order.logistics.corridorLabel,
        tracking: order.logistics.trackingCode ?? "En attente",
        agent: order.logistics.agentName,
        href: `/admin/imports/${encodeURIComponent(order.id.replace("#", ""))}`,
      } satisfies AdminImportRequest;
    });
}

export function getAdminImportRequestById(importId: string) {
  return getAdminImportRequests().find((request) => request.orderId.replace("#", "") === importId) ?? null;
}

export function getAdminReviews() {
  const ratings = [5, 5, 5, 5, 4, 4, 3, 2, 2, 1];
  const reviewers = [
    "Amina K.",
    "Noah M.",
    "Sonia D.",
    "Koffi A.",
    "Lea B.",
    "David T.",
    "Ines P.",
    "Moussa F.",
    "Rita C.",
    "Sarah L.",
  ];

  return products.slice(0, 10).map((product, index) => ({
    product: product.shortTitle,
    score: ratings[index] ?? 4,
    reviewer: reviewers[index] ?? "Client vérifié",
    summary: product.soldLabel,
    status: index === 7 ? "Masqué" : "Publié",
    responseStatus: index === 6 || index === 8 || index === 9 ? "Réponse attendue" : "Répondu",
    href: `/products/${product.slug}`,
  }));
}

export const adminSettingsGroups = [
  { label: "Localisation", detail: "Pays FR par defaut, devise contextualisee et langue derivee.", href: "/pricing" },
  { label: "Support vendeur", detail: "Canaux messages relies aux agents logistiques et service client.", href: "/messages" },
  { label: "Catalogue", detail: "Moteur de recherche, suggestions et taxonomie produits centralises.", href: "/products" },
];

export function getAdminSectionMeta(slug: AdminSectionSlug) {
  return adminNavItems.find((item) => item.slug === slug) ?? null;
}