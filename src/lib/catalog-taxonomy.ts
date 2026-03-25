export type CatalogCategoryDefinition = {
  slug: string;
  title: string;
  description: string;
  productSlugs: string[];
};

export const catalogCategories: CatalogCategoryDefinition[] = [
  {
    slug: "for-you",
    title: "Categories pour vous",
    description: "Selection premium des familles produit les plus consultees sur AfriPay.",
    productSlugs: [
      "souris-gaming-g502x-rgb-usb",
      "combo-clavier-souris-onikuma-rgb",
      "lunettes-vr-3d-metavers-hifi",
      "fauteuil-gaming-rgb-oem-luxe",
      "bureau-gaming-fibre-carbone-led",
      "piercing-g23-titane-zircon",
      "hoodie-oversize-coton-unisexe",
    ],
  },
  {
    slug: "consumer-electronics",
    title: "Electronique grand public",
    description: "Accessoires PC, VR et bundles high-rotation pour sourcing retail et grossiste.",
    productSlugs: [
      "souris-gaming-g502x-rgb-usb",
      "lunettes-vr-3d-metavers-hifi",
      "combo-clavier-souris-onikuma-rgb",
      "tapis-souris-clavier-rgb-chauffant",
      "machine-vr-9d-moviepower",
    ],
  },
  {
    slug: "jewelry-watches",
    title: "Bijoux, Lunettes & Montres",
    description: "References legeres a marge rapide pour boutiques, e-commerce et assortiment tendance.",
    productSlugs: [
      "piercing-g23-titane-zircon",
      "lunettes-vr-3d-metavers-hifi",
      "souris-gaming-g502x-rgb-usb",
    ],
  },
  {
    slug: "office-supplies",
    title: "Fournitures de bureau",
    description: "Postes de travail, accessoires bureautiques et mobilier de rendement pour usage professionnel.",
    productSlugs: [
      "bureau-gaming-fibre-carbone-led",
      "bureau-esport-design-simple",
      "combo-clavier-souris-onikuma-rgb",
      "souris-gaming-g502x-rgb-usb",
    ],
  },
  {
    slug: "agriculture-food",
    title: "Agriculture, Aliments & Boissons",
    description: "Produits agricoles, alimentaires et boissons pour besoins B2B et sourcing complementaire.",
    productSlugs: [
      "bean-bag-gaming-oxford",
      "bureau-esport-design-simple",
      "tapis-souris-clavier-rgb-chauffant",
    ],
  },
  {
    slug: "fashion-accessories",
    title: "Vetements & Accessoires",
    description: "Produits de style, merchandising et accessoires a forte lecture visuelle pour ventes digitales.",
    productSlugs: [
      "piercing-g23-titane-zircon",
      "bean-bag-gaming-oxford",
      "fauteuil-gaming-rgb-oem-luxe",
      "hoodie-oversize-coton-unisexe",
      "ensemble-sport-femme-deux-pieces",
    ],
  },
  {
    slug: "home-garden",
    title: "Maison & Jardin",
    description: "Mobilier, assises et solutions d'amenagement pour retail, showrooms et vente projet.",
    productSlugs: [
      "bean-bag-gaming-oxford",
      "fauteuil-gaming-rgb-oem-luxe",
      "bureau-gaming-fibre-carbone-led",
      "bureau-esport-design-simple",
    ],
  },
  {
    slug: "sports-leisure",
    title: "Sports & Loisirs",
    description: "Equipements immersifs, accessoires gaming et articles loisirs a forte attractivite commerciale.",
    productSlugs: [
      "machine-vr-9d-moviepower",
      "lunettes-vr-3d-metavers-hifi",
      "bean-bag-gaming-oxford",
      "tapis-souris-clavier-rgb-chauffant",
    ],
  },
  {
    slug: "sportswear-clothing",
    title: "Tenues de sport et vetements",
    description: "Selection compatible avec activations lifestyle, corners gaming et assortiment sportif tendance.",
    productSlugs: [
      "bean-bag-gaming-oxford",
      "fauteuil-gaming-rgb-oem-luxe",
      "piercing-g23-titane-zircon",
      "hoodie-oversize-coton-unisexe",
      "ensemble-sport-femme-deux-pieces",
    ],
  },
];

export function getCatalogCategoryBySlug(slug: string) {
  return catalogCategories.find((category) => category.slug === slug) ?? null;
}

export const catalogQuickSearchLinks = [
  { slug: "mouse", title: "Souris", query: "souris" },
  { slug: "gaming-mouse", title: "Souris de jeu", query: "gaming souris" },
  { slug: "mouse-pad", title: "Tapis de souris", query: "tapis souris" },
  { slug: "nose-piercing", title: "Piercing au nez", query: "piercing" },
  { slug: "piercing-jewelry", title: "Bijoux de percage", query: "piercing bijoux" },
  { slug: "tablet", title: "Tablette", query: "VR" },
  { slug: "laptops", title: "Ordinateurs portables", query: "ordinateur" },
  { slug: "battery", title: "Batterie", query: "USB" },
  { slug: "keyboard-mouse", title: "Clavier et souris", query: "clavier souris" },
  { slug: "wireless-mic", title: "Micro sans fil", query: "casque" },
  { slug: "gaming-keyboards", title: "Claviers de jeu", query: "clavier gaming" },
  { slug: "gaming-laptops", title: "Ordinateurs portables de jeu", query: "gaming" },
  { slug: "desktops", title: "Ordinateurs de bureau", query: "bureau gaming" },
  { slug: "mini-pc", title: "Mini-ordinateur", query: "combo" },
];