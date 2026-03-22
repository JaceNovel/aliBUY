export type ProductTier = {
  quantityLabel: string;
  priceUsd: number;
  note?: string;
};

export type ProductVariantGroup = {
  label: string;
  values: string[];
};

export type ProductCatalogItem = {
  slug: string;
  title: string;
  shortTitle: string;
  keywords?: string[];
  image: string;
  gallery: string[];
  videoUrl?: string;
  videoPoster?: string;
  packaging: string;
  itemWeightGrams: number;
  lotCbm: string;
  minUsd: number;
  maxUsd?: number;
  moq: number;
  unit: string;
  badge?: string;
  supplierName: string;
  supplierLocation: string;
  responseTime: string;
  yearsInBusiness: number;
  transactionsLabel: string;
  soldLabel: string;
  customizationLabel: string;
  shippingLabel: string;
  overview: string[];
  variantGroups: ProductVariantGroup[];
  tiers: ProductTier[];
  specs: Array<{ label: string; value: string }>;
};

export const products: ProductCatalogItem[] = [
  {
    slug: "souris-gaming-g502x-rgb-usb",
    title: "Souris Gaming G502X, filaire USB, RVB, optique ergonomique, meilleure vente pour PC et ordinateur portable",
    shortTitle: "Souris gaming G502X RVB USB",
    image: "https://s.alicdn.com/@sc04/kf/H097752b8b24344aebcabb135315e1a8d2.jpg_350x350.jpg",
    gallery: [
      "https://s.alicdn.com/@sc04/kf/H097752b8b24344aebcabb135315e1a8d2.jpg_350x350.jpg",
      "https://s.alicdn.com/@sc04/kf/H9d54069b496a4915a948cb6d88ed0435j.jpg_350x350.jpg",
      "https://s.alicdn.com/@sc04/kf/A9b5ae44e0d0c4feba3f2670fe576e8eck.jpg_350x350.jpg",
      "https://s.alicdn.com/@sc04/kf/H8875a3ee8ddc4ad7b846d7a4fb94c2835.jpg_350x350.jpg",
      "https://s.alicdn.com/@sc04/kf/H5d39629cd6374a32bea7368985f32f7aR.jpg_350x350.jpg"
    ],
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
    videoPoster: "https://s.alicdn.com/@sc04/kf/H9d54069b496a4915a948cb6d88ed0435j.jpg_350x350.jpg",
    packaging: "Boite retail + carton export",
    itemWeightGrams: 240,
    lotCbm: "0.062 m3 / lot de 100 pcs",
    minUsd: 6.17,
    maxUsd: 8.42,
    moq: 100,
    unit: "pièces",
    badge: "Offre mise en avant",
    supplierName: "Shenzhen Vortex Esports Technology Co., Ltd.",
    supplierLocation: "Guangdong, China",
    responseTime: "≤ 6 h",
    yearsInBusiness: 6,
    transactionsLabel: "214 commandes confirmées",
    soldLabel: "3,2k pièces vendues en 90 jours",
    customizationLabel: "Logo OEM, couleur LED, packaging retail",
    shippingLabel: "Expédition express disponible sous 7 jours",
    overview: [
      "Capteur optique haute précision pour usage bureautique et gaming.",
      "Coque ergonomique texturée avec zones antidérapantes.",
      "Configuration OEM possible pour revendeurs et intégrateurs.",
      "Contrôle qualité unitaire avant emballage export."
    ],
    variantGroups: [
      { label: "Coloris", values: ["Noir carbone", "Blanc glacier", "Noir + LED rouge"] },
      { label: "Interface", values: ["USB-A", "USB-C", "USB-A + adaptateur"] },
      { label: "Conditionnement", values: ["Bulk carton", "Boîte retail", "Blister OEM"] }
    ],
    tiers: [
      { quantityLabel: "100-299 pièces", priceUsd: 8.42, note: "MOQ standard" },
      { quantityLabel: "300-999 pièces", priceUsd: 7.18, note: "Packaging personnalisé" },
      { quantityLabel: "1000+ pièces", priceUsd: 6.17, note: "Prix usine prioritaire" }
    ],
    specs: [
      { label: "DPI", value: "800 / 1600 / 2400 / 3200" },
      { label: "Matériau", value: "ABS texturé + patins PTFE" },
      { label: "Tension", value: "5V USB" },
      { label: "Compatibilité", value: "Windows, macOS, Linux" },
      { label: "Certifications", value: "CE, FCC, RoHS" },
      { label: "Délai échantillon", value: "3 à 5 jours" }
    ]
  },
  {
    slug: "piercing-g23-titane-zircon",
    title: "Zoor top vendeur G23 titane côté incrustation zircon, anneau segment pour septum, piercing mode, sac Opp 5 pièces",
    shortTitle: "Piercing G23 titane zircon",
    image: "https://s.alicdn.com/@sc04/kf/Hd3d4e4b17e974cf4905556da65241a90t.jpg_350x350.jpg",
    gallery: [
      "https://s.alicdn.com/@sc04/kf/Hd3d4e4b17e974cf4905556da65241a90t.jpg_350x350.jpg",
      "https://s.alicdn.com/@sc04/kf/Hd3d4e4b17e974cf4905556da65241a90t.jpg_350x350.jpg",
      "https://s.alicdn.com/@sc04/kf/Hd3d4e4b17e974cf4905556da65241a90t.jpg_350x350.jpg"
    ],
    videoPoster: "https://s.alicdn.com/@sc04/kf/Hd3d4e4b17e974cf4905556da65241a90t.jpg_350x350.jpg",
    packaging: "Sachet OPP 5 pcs + carton",
    itemWeightGrams: 8,
    lotCbm: "0.012 m3 / lot de 500 pcs",
    minUsd: 1.21,
    maxUsd: 1.96,
    moq: 5,
    unit: "pièces",
    supplierName: "Wenzhou Zoor Body Jewelry Co., Ltd.",
    supplierLocation: "Zhejiang, China",
    responseTime: "≤ 10 h",
    yearsInBusiness: 4,
    transactionsLabel: "89 commandes confirmées",
    soldLabel: "14k unités vendues en 90 jours",
    customizationLabel: "Cartes logo, sachets OPP, finition anodisée",
    shippingLabel: "Échantillons mixtes disponibles immédiatement",
    overview: [
      "Titane G23 poli miroir avec zircons sertis.",
      "Tailles adaptées à la revente en bijouterie et e-commerce.",
      "Conditionnement par lot de 5 pièces sous sachet OPP.",
      "Options couleur et diamètre disponibles sur demande."
    ],
    variantGroups: [
      { label: "Couleur", values: ["Argent", "Or rose", "Noir anodisé"] },
      { label: "Diamètre", values: ["8 mm", "10 mm", "12 mm"] },
      { label: "Épaisseur", values: ["1.0 mm", "1.2 mm", "1.6 mm"] }
    ],
    tiers: [
      { quantityLabel: "5-49 pièces", priceUsd: 1.96, note: "Mélange de tailles possible" },
      { quantityLabel: "50-299 pièces", priceUsd: 1.48, note: "Packaging OEM" },
      { quantityLabel: "300+ pièces", priceUsd: 1.21, note: "Prix distributeur" }
    ],
    specs: [
      { label: "Matière", value: "Titane G23" },
      { label: "Pierre", value: "Zircon cubique" },
      { label: "Polissage", value: "Finition miroir" },
      { label: "Usage", value: "Septum, nez, cartilage" },
      { label: "Emballage", value: "Sachet OPP 5 pcs" },
      { label: "Délais", value: "2 à 4 jours" }
    ]
  },
  {
    slug: "machine-vr-9d-moviepower",
    title: "MoviePower machine de réalité virtuelle pour aire de jeux enfants, équipement thématique intérieur, machine d'arcade VR 9D",
    shortTitle: "Machine d'arcade VR 9D",
    image: "https://s.alicdn.com/@sc04/kf/Hceaca7de363f49c5b1ff43ce10a17bc9P.jpg_350x350.jpg",
    gallery: [
      "https://s.alicdn.com/@sc04/kf/Hceaca7de363f49c5b1ff43ce10a17bc9P.jpg_350x350.jpg",
      "https://s.alicdn.com/@sc04/kf/Hade212866dcd410fa307eb672830a249i.jpg_350x350.jpg",
      "https://s.alicdn.com/@sc04/kf/H5d39629cd6374a32bea7368985f32f7aR.jpg_350x350.jpg",
      "https://s.alicdn.com/@sc04/kf/H8875a3ee8ddc4ad7b846d7a4fb94c2835.jpg_350x350.jpg"
    ],
    packaging: "Caisse bois export",
    itemWeightGrams: 320000,
    lotCbm: "7.980 m3 / lot de 1 jeu",
    minUsd: 6265.33,
    maxUsd: 7120,
    moq: 1,
    unit: "jeu",
    badge: "Promo",
    supplierName: "Guangzhou MoviePower Technology Co., Ltd.",
    supplierLocation: "Guangzhou, China",
    responseTime: "≤ 12 h",
    yearsInBusiness: 9,
    transactionsLabel: "36 projets installés cette année",
    soldLabel: "Référence utilisée dans 12 salles d’arcade export",
    customizationLabel: "Habillage complet, jeux préinstallés, branding opérateur",
    shippingLabel: "Montage, support vidéo et caisse export bois inclus",
    overview: [
      "Plateforme VR dynamique pour salles d’arcade et family centers.",
      "Bibliothèque de contenus préchargés et maintenance distante.",
      "Habillage lumineux personnalisable à la marque du client.",
      "Livraison CKD ou machine assemblée selon destination."
    ],
    variantGroups: [
      { label: "Version", values: ["1 place", "2 places", "2 places deluxe"] },
      { label: "Tension", values: ["220V", "110V", "220V triphasé"] },
      { label: "Bundle", values: ["Standard", "Jeux + support", "Clé en main"] }
    ],
    tiers: [
      { quantityLabel: "1 jeu", priceUsd: 7120, note: "Avec jeux standards" },
      { quantityLabel: "2-4 jeux", priceUsd: 6680, note: "Installation groupée" },
      { quantityLabel: "5+ jeux", priceUsd: 6265.33, note: "Projet parc indoor" }
    ],
    specs: [
      { label: "Dimensions", value: "220 x 155 x 235 cm" },
      { label: "Puissance", value: "2.5 kW" },
      { label: "Âge recommandé", value: "8+" },
      { label: "Contenus", value: "12 à 24 jeux selon pack" },
      { label: "Garantie", value: "12 mois pièces" },
      { label: "Emballage", value: "Caisse bois export" }
    ]
  },
  {
    slug: "bean-bag-gaming-oxford",
    title: "Fourniture directe d'usine gaming bean bag, chaise en tissu Oxford, pouf à dossier haut pour adolescents",
    shortTitle: "Bean bag gaming Oxford",
    image: "https://s.alicdn.com/@sc04/kf/H5a5b74ce8bca41bdaeb883513631b6827.png_350x350.jpg",
    gallery: [
      "https://s.alicdn.com/@sc04/kf/H5a5b74ce8bca41bdaeb883513631b6827.png_350x350.jpg",
      "https://s.alicdn.com/@sc04/kf/He21b090337c74bbaa1212b233936914aa.jpg_350x350.jpg",
      "https://s.alicdn.com/@sc04/kf/H5d39629cd6374a32bea7368985f32f7aR.jpg_350x350.jpg"
    ],
    packaging: "Sac PE comprime + carton",
    itemWeightGrams: 3800,
    lotCbm: "1.280 m3 / lot de 20 sets",
    minUsd: 10.45,
    maxUsd: 12.35,
    moq: 300,
    unit: "jeux",
    badge: "Livraison rapide",
    supplierName: "Ningbo Cozy Leisure Furniture Co., Ltd.",
    supplierLocation: "Ningbo, China",
    responseTime: "≤ 8 h",
    yearsInBusiness: 7,
    transactionsLabel: "128 lots exportés",
    soldLabel: "Top 10 seller catégorie gaming lounge",
    customizationLabel: "Broderie, labels tissés, couleurs tissu",
    shippingLabel: "Production rapide avec compression sous vide",
    overview: [
      "Pouf gaming grand format avec tissu Oxford anti-abrasion.",
      "Remplissage EPS haute densité et dossier enveloppant.",
      "Conçu pour corner gaming, dortoirs et revendeurs ameublement.",
      "Expédié compressé pour réduire le volume logistique."
    ],
    variantGroups: [
      { label: "Couleur", values: ["Noir orange", "Noir rouge", "Gris anthracite"] },
      { label: "Remplissage", values: ["EPS standard", "EPS premium", "Sans remplissage"] },
      { label: "Marquage", values: ["Sans logo", "Broderie", "Patch PVC"] }
    ],
    tiers: [
      { quantityLabel: "300-499 sets", priceUsd: 12.35, note: "Palette mixte" },
      { quantityLabel: "500-999 sets", priceUsd: 11.26, note: "Coloris personnalisés" },
      { quantityLabel: "1000+ sets", priceUsd: 10.45, note: "Production dédiée" }
    ],
    specs: [
      { label: "Tissu", value: "Oxford 600D" },
      { label: "Remplissage", value: "Billes EPS" },
      { label: "Dimension", value: "90 x 85 x 95 cm" },
      { label: "Charge max", value: "120 kg" },
      { label: "Usage", value: "Indoor" },
      { label: "Délai", value: "10 à 15 jours" }
    ]
  },
  {
    slug: "lunettes-vr-3d-metavers-hifi",
    title: "Lunettes de réalité virtuelle 3D métavers avec casque HIFI pour films et jeux avec télécommande",
    shortTitle: "Lunettes VR 3D avec casque HIFI",
    image: "https://s.alicdn.com/@sc04/kf/Hade212866dcd410fa307eb672830a249i.jpg_350x350.jpg",
    gallery: [
      "https://s.alicdn.com/@sc04/kf/Hade212866dcd410fa307eb672830a249i.jpg_350x350.jpg",
      "https://s.alicdn.com/@sc04/kf/Hceaca7de363f49c5b1ff43ce10a17bc9P.jpg_350x350.jpg",
      "https://s.alicdn.com/@sc04/kf/H9d54069b496a4915a948cb6d88ed0435j.jpg_350x350.jpg"
    ],
    packaging: "Boite couleur + carton export",
    itemWeightGrams: 410,
    lotCbm: "0.095 m3 / lot de 20 pcs",
    minUsd: 11.87,
    maxUsd: 13.77,
    moq: 5,
    unit: "pièces",
    supplierName: "Shenzhen Metaview Digital Technology Co., Ltd.",
    supplierLocation: "Shenzhen, China",
    responseTime: "≤ 5 h",
    yearsInBusiness: 5,
    transactionsLabel: "67 lots OEM lancés",
    soldLabel: "Bundle retail populaire sur marketplaces africaines",
    customizationLabel: "Sleeve box, notice FR/EN, branding télécommande",
    shippingLabel: "Expédition aérienne et maritime disponible",
    overview: [
      "Casque VR mobile avec lentilles ajustables et audio intégré.",
      "Télécommande Bluetooth incluse pour navigation et jeux basiques.",
      "Compatible smartphones Android et iPhone jusqu’à 7 pouces.",
      "Solution adaptée aux boutiques tech et packs cadeaux."
    ],
    variantGroups: [
      { label: "Couleur", values: ["Noir mat", "Blanc", "Noir orange"] },
      { label: "Bundle", values: ["Casque seul", "Casque + télécommande", "Casque + écouteurs"] },
      { label: "Packaging", values: ["Neutre", "Marque privée", "Bundle retail"] }
    ],
    tiers: [
      { quantityLabel: "5-49 pièces", priceUsd: 13.77, note: "Petite série" },
      { quantityLabel: "50-199 pièces", priceUsd: 12.64, note: "Notice multilingue" },
      { quantityLabel: "200+ pièces", priceUsd: 11.87, note: "Prix OEM" }
    ],
    specs: [
      { label: "Angle de vue", value: "95-100°" },
      { label: "Compatibilité écran", value: "4.7 à 7.0 pouces" },
      { label: "Connexion", value: "Bluetooth pour télécommande" },
      { label: "Audio", value: "Casque HIFI intégré" },
      { label: "Poids", value: "410 g" },
      { label: "Échantillon", value: "Disponible" }
    ]
  },
  {
    slug: "fauteuil-gaming-rgb-oem-luxe",
    title: "Fauteuil de jeu électrique RGB de luxe OEM en gros avec logo personnalisé, cuir synthétique et lumières LED",
    shortTitle: "Fauteuil gaming RGB OEM luxe",
    image: "https://s.alicdn.com/@sc04/kf/He21b090337c74bbaa1212b233936914aa.jpg_350x350.jpg",
    gallery: [
      "https://s.alicdn.com/@sc04/kf/He21b090337c74bbaa1212b233936914aa.jpg_350x350.jpg",
      "https://s.alicdn.com/@sc04/kf/H5d39629cd6374a32bea7368985f32f7aR.jpg_350x350.jpg",
      "https://s.alicdn.com/@sc04/kf/H5a5b74ce8bca41bdaeb883513631b6827.png_350x350.jpg",
      "https://s.alicdn.com/@sc04/kf/H8875a3ee8ddc4ad7b846d7a4fb94c2835.jpg_350x350.jpg"
    ],
    packaging: "Carton KD renforce",
    itemWeightGrams: 17500,
    lotCbm: "0.335 m3 / lot de 1 pc",
    minUsd: 18.98,
    maxUsd: 22.78,
    moq: 50,
    unit: "pièces",
    supplierName: "Anji Prime Seat Technology Co., Ltd.",
    supplierLocation: "Zhejiang, China",
    responseTime: "≤ 4 h",
    yearsInBusiness: 8,
    transactionsLabel: "312 sièges exportés ce trimestre",
    soldLabel: "Produit vedette pour revendeurs gaming",
    customizationLabel: "Logo embossé, LED RGB, carton imprimé",
    shippingLabel: "Stocks semi-finis pour commandes urgentes",
    overview: [
      "Fauteuil gaming avec dossier inclinable, coussins et LED RGB.",
      "Disponible en versions OEM et ODM pour enseignes spécialisées.",
      "Montage simple et cartons compacts pour transport container.",
      "Supporte revendeurs, cybercafés et bundles e-sport."
    ],
    variantGroups: [
      { label: "Coloris", values: ["Noir rouge", "Noir orange", "Noir bleu"] },
      { label: "Finition", values: ["PU standard", "PU premium", "Tissu mixte"] },
      { label: "Éclairage", values: ["Sans RGB", "RGB latéral", "RGB complet USB"] }
    ],
    tiers: [
      { quantityLabel: "50-199 pièces", priceUsd: 22.78, note: "Configuration catalogue" },
      { quantityLabel: "200-499 pièces", priceUsd: 20.65, note: "Logo personnalisé" },
      { quantityLabel: "500+ pièces", priceUsd: 18.98, note: "Prix usine FOB" }
    ],
    specs: [
      { label: "Revêtement", value: "PU synthétique" },
      { label: "Inclinaison", value: "90° à 155°" },
      { label: "Base", value: "Nylon renforcé 350 mm" },
      { label: "Charge max", value: "150 kg" },
      { label: "Garantie", value: "24 mois structure" },
      { label: "Délai production", value: "15 à 20 jours" }
    ]
  },
  {
    slug: "bureau-gaming-fibre-carbone-led",
    title: "Bureau de jeu à domicile personnalisé, surface fibre de carbone en Z, éclairage LED RVB",
    shortTitle: "Bureau gaming fibre carbone LED",
    image: "https://s.alicdn.com/@sc04/kf/H5d39629cd6374a32bea7368985f32f7aR.jpg_350x350.jpg",
    gallery: [
      "https://s.alicdn.com/@sc04/kf/H5d39629cd6374a32bea7368985f32f7aR.jpg_350x350.jpg",
      "https://s.alicdn.com/@sc04/kf/He21b090337c74bbaa1212b233936914aa.jpg_350x350.jpg",
      "https://s.alicdn.com/@sc04/kf/H8875a3ee8ddc4ad7b846d7a4fb94c2835.jpg_350x350.jpg"
    ],
    packaging: "Carton mousse KD",
    itemWeightGrams: 21500,
    lotCbm: "0.188 m3 / lot de 1 set",
    minUsd: 25.46,
    maxUsd: 31.82,
    moq: 20,
    unit: "jeux",
    badge: "En stock",
    supplierName: "Foshan Carbon Edge Furniture Co., Ltd.",
    supplierLocation: "Foshan, China",
    responseTime: "≤ 7 h",
    yearsInBusiness: 6,
    transactionsLabel: "95 lots B2B expédiés",
    soldLabel: "Faible MOQ pour distributeurs régionaux",
    customizationLabel: "Support casque, tapis, LED, logo frame",
    shippingLabel: "Production flexible avec pièces KD",
    overview: [
      "Bureau gaming structure Z avec plateau finition fibre carbone.",
      "Gestion des câbles, LED RVB et accessoires intégrés possibles.",
      "Expédié démonté pour optimiser le chargement export.",
      "Adapté retail, cybercafés et ventes flash promotionnelles."
    ],
    variantGroups: [
      { label: "Dimension", values: ["100 cm", "120 cm", "140 cm"] },
      { label: "Éclairage", values: ["Sans LED", "LED RGB latérale", "LED RGB complète"] },
      { label: "Accessoires", values: ["Nus", "Porte-gobelet", "Pack complet"] }
    ],
    tiers: [
      { quantityLabel: "20-99 sets", priceUsd: 31.82, note: "Stock standard" },
      { quantityLabel: "100-299 sets", priceUsd: 28.14, note: "Packaging marque privée" },
      { quantityLabel: "300+ sets", priceUsd: 25.46, note: "Prix container" }
    ],
    specs: [
      { label: "Plateau", value: "MDF + film fibre carbone" },
      { label: "Structure", value: "Acier peint poudre" },
      { label: "Charge max", value: "80 kg" },
      { label: "Montage", value: "KD flat pack" },
      { label: "Couleurs", value: "Noir / noir rouge" },
      { label: "Délai", value: "12 à 18 jours" }
    ]
  },
  {
    slug: "bureau-esport-design-simple",
    title: "Bureau de jeu sur ordinateur au design simple, e-sport, maison et cybercafés",
    shortTitle: "Bureau e-sport design simple",
    image: "https://s.alicdn.com/@sc04/kf/H8875a3ee8ddc4ad7b846d7a4fb94c2835.jpg_350x350.jpg",
    gallery: [
      "https://s.alicdn.com/@sc04/kf/H8875a3ee8ddc4ad7b846d7a4fb94c2835.jpg_350x350.jpg",
      "https://s.alicdn.com/@sc04/kf/H5d39629cd6374a32bea7368985f32f7aR.jpg_350x350.jpg",
      "https://s.alicdn.com/@sc04/kf/He21b090337c74bbaa1212b233936914aa.jpg_350x350.jpg"
    ],
    minUsd: 20.64,
    maxUsd: 25.79,
    moq: 20,
    unit: "jeux",
    badge: "En stock",
    supplierName: "Guangzhou Cyberhall Fixtures Co., Ltd.",
    supplierLocation: "Guangdong, China",
    responseTime: "≤ 8 h",
    yearsInBusiness: 10,
    transactionsLabel: "410 postes installés en cybercafés",
    soldLabel: "Produit stable pour appels d’offres locaux",
    customizationLabel: "Coloris plateau, passe-câbles, stickers brandés",
    shippingLabel: "Expédition groupée Afrique de l’Ouest disponible",
    overview: [
      "Bureau e-sport épuré pour installation rapide en série.",
      "Format robuste adapté à domicile, espaces gaming et cafés internet.",
      "Structure simple permettant un montage terrain en quelques minutes.",
      "Disponible en lots homogènes ou mix tailles."
    ],
    variantGroups: [
      { label: "Largeur", values: ["100 cm", "120 cm", "160 cm"] },
      { label: "Coloris", values: ["Noir", "Noir rouge", "Bois foncé"] },
      { label: "Option", values: ["Standard", "Passe-câbles", "Support unité centrale"] }
    ],
    tiers: [
      { quantityLabel: "20-79 sets", priceUsd: 25.79, note: "Commande test" },
      { quantityLabel: "80-199 sets", priceUsd: 22.93, note: "Projet cybercafé" },
      { quantityLabel: "200+ sets", priceUsd: 20.64, note: "Prix distributeur" }
    ],
    specs: [
      { label: "Plateau", value: "Mélaminé 18 mm" },
      { label: "Pieds", value: "Acier peint" },
      { label: "Montage", value: "Assemblage 15 min" },
      { label: "Charge", value: "60 kg" },
      { label: "Usage", value: "Maison / cybercafé" },
      { label: "Échantillon", value: "Oui" }
    ]
  },
  {
    slug: "tapis-souris-clavier-rgb-chauffant",
    title: "Tapis de souris et clavier de jeu surdimensionné chauffant avec LED RGB, prise USB, en stock",
    shortTitle: "Tapis gaming RGB chauffant USB",
    image: "https://s.alicdn.com/@sc04/kf/A9b5ae44e0d0c4feba3f2670fe576e8eck.jpg_350x350.jpg",
    gallery: [
      "https://s.alicdn.com/@sc04/kf/A9b5ae44e0d0c4feba3f2670fe576e8eck.jpg_350x350.jpg",
      "https://s.alicdn.com/@sc04/kf/H097752b8b24344aebcabb135315e1a8d2.jpg_350x350.jpg",
      "https://s.alicdn.com/@sc04/kf/H9d54069b496a4915a948cb6d88ed0435j.jpg_350x350.jpg"
    ],
    minUsd: 3.61,
    maxUsd: 4.57,
    moq: 100,
    unit: "pièces",
    badge: "Livraison rapide",
    supplierName: "Dongguan Glowmat Accessories Co., Ltd.",
    supplierLocation: "Dongguan, China",
    responseTime: "≤ 5 h",
    yearsInBusiness: 5,
    transactionsLabel: "180 références actives",
    soldLabel: "Très demandé sur bundles PC gaming",
    customizationLabel: "Couleurs lumière, logo, boîte kraft retail",
    shippingLabel: "Stock pour commandes urgentes disponible",
    overview: [
      "Grand tapis de bureau pour clavier et souris avec contour RGB.",
      "Option chauffante USB pour usage saisonnier et merchandising original.",
      "Surface microtexturée pour glisse stable.",
      "Produit adapté aux bundles gaming entrée de gamme."
    ],
    variantGroups: [
      { label: "Taille", values: ["80 x 30 cm", "90 x 40 cm", "120 x 60 cm"] },
      { label: "Fonction", values: ["RGB", "RGB + chauffe", "Chauffe seule"] },
      { label: "Packaging", values: ["Tube", "Boîte retail", "Sac zip"] }
    ],
    tiers: [
      { quantityLabel: "100-299 pièces", priceUsd: 4.57, note: "Stock standard" },
      { quantityLabel: "300-999 pièces", priceUsd: 4.02, note: "Impression logo" },
      { quantityLabel: "1000+ pièces", priceUsd: 3.61, note: "Prix promotionnel" }
    ],
    specs: [
      { label: "Surface", value: "Tissu + base caoutchouc" },
      { label: "Connexion", value: "USB 5V" },
      { label: "Éclairage", value: "RGB multizone" },
      { label: "Fonction chauffe", value: "Oui selon version" },
      { label: "Épaisseur", value: "3 à 4 mm" },
      { label: "Délai", value: "5 à 7 jours" }
    ]
  },
  {
    slug: "combo-clavier-souris-onikuma-rgb",
    title: "Onikuma combo clavier souris et tapis de souris gaming RGB, logo personnalisé",
    shortTitle: "Combo clavier souris Onikuma RGB",
    image: "https://s.alicdn.com/@sc04/kf/H9d54069b496a4915a948cb6d88ed0435j.jpg_350x350.jpg",
    gallery: [
      "https://s.alicdn.com/@sc04/kf/H9d54069b496a4915a948cb6d88ed0435j.jpg_350x350.jpg",
      "https://s.alicdn.com/@sc04/kf/H097752b8b24344aebcabb135315e1a8d2.jpg_350x350.jpg",
      "https://s.alicdn.com/@sc04/kf/A9b5ae44e0d0c4feba3f2670fe576e8eck.jpg_350x350.jpg"
    ],
    minUsd: 10.5,
    maxUsd: 11.39,
    moq: 20,
    unit: "jeux",
    badge: "Promo",
    supplierName: "Shenzhen Onikuma Peripheral Co., Ltd.",
    supplierLocation: "Shenzhen, China",
    responseTime: "≤ 3 h",
    yearsInBusiness: 8,
    transactionsLabel: "520 bundles expédiés cette saison",
    soldLabel: "Idéal pour marketplaces et opérations bundle",
    customizationLabel: "Logo top cover, keycaps, sleeve packaging",
    shippingLabel: "Échantillon express sous 48h",
    overview: [
      "Ensemble clavier, souris et tapis pour ventes bundle à forte rotation.",
      "Rétroéclairage RGB et packaging retail disponible.",
      "Configuration simple pour revendeurs gaming et boutiques informatiques.",
      "Produit optimisé pour promotions et ventes saisonnières."
    ],
    variantGroups: [
      { label: "Disposition", values: ["US", "FR", "UK"] },
      { label: "Couleur", values: ["Noir", "Blanc", "Noir orange"] },
      { label: "Bundle", values: ["3 en 1", "2 en 1", "4 en 1 avec casque"] }
    ],
    tiers: [
      { quantityLabel: "20-99 jeux", priceUsd: 11.39, note: "Série standard" },
      { quantityLabel: "100-299 jeux", priceUsd: 10.96, note: "Logo personnalisé" },
      { quantityLabel: "300+ jeux", priceUsd: 10.5, note: "Prix promo usine" }
    ],
    specs: [
      { label: "Type clavier", value: "Membrane gaming" },
      { label: "Souris", value: "6 boutons RGB" },
      { label: "Tapis", value: "Antidérapant" },
      { label: "Connexion", value: "USB filaire" },
      { label: "Marquage", value: "OEM / ODM" },
      { label: "Délai", value: "3 à 7 jours" }
    ]
  },
  {
    slug: "hoodie-oversize-coton-unisexe",
    title: "Sweat a capuche oversize unisexe 100% coton avec marquage OEM et coloris tendance pour collections streetwear",
    shortTitle: "Hoodie oversize coton unisexe",
    keywords: ["habit", "vetement", "hoodie", "sweat", "streetwear", "fashion", "mode", "clothes"],
    image: "/products/fashion-hoodie.svg",
    gallery: [
      "/products/fashion-hoodie.svg",
      "/products/fashion-hoodie.svg",
      "/products/fashion-hoodie.svg"
    ],
    packaging: "Sachet individuel + carton export",
    itemWeightGrams: 620,
    lotCbm: "0.145 m3 / lot de 50 pcs",
    minUsd: 9.85,
    maxUsd: 12.4,
    moq: 50,
    unit: "pièces",
    badge: "En stock",
    supplierName: "Guangzhou Urban Thread Apparel Co., Ltd.",
    supplierLocation: "Guangzhou, China",
    responseTime: "≤ 6 h",
    yearsInBusiness: 7,
    transactionsLabel: "148 lots fashion exportés",
    soldLabel: "Produit rapide pour corners mode et drops streetwear",
    customizationLabel: "Broderie poitrine, patch logo, étiquette privée",
    shippingLabel: "Stocks tissus disponibles pour production rapide",
    overview: [
      "Coupe oversize moderne pensée pour capsules streetwear et merchandising premium.",
      "Molleton coton épais avec capuche doublée et finitions soignées.",
      "Compatible branding complet: étiquette, broderie, sérigraphie et packaging.",
      "Coloris neutres et mode pour collections retail, influence et e-commerce."
    ],
    variantGroups: [
      { label: "Couleur", values: ["Beige sable", "Noir profond", "Gris perle"] },
      { label: "Taille", values: ["S", "M", "L", "XL"] },
      { label: "Marquage", values: ["Sans logo", "Broderie", "Sérigraphie"] }
    ],
    tiers: [
      { quantityLabel: "50-199 pièces", priceUsd: 12.4, note: "Stock tissus disponible" },
      { quantityLabel: "200-499 pièces", priceUsd: 10.96, note: "Private label" },
      { quantityLabel: "500+ pièces", priceUsd: 9.85, note: "Prix usine fashion" }
    ],
    specs: [
      { label: "Matière", value: "100% coton molleton 420 g" },
      { label: "Coupe", value: "Oversize unisexe" },
      { label: "Capuche", value: "Doublée avec cordon plat" },
      { label: "Usage", value: "Streetwear, retail, merchandising" },
      { label: "Poids", value: "620 g" },
      { label: "Délai", value: "7 à 12 jours" }
    ]
  },
  {
    slug: "ensemble-sport-femme-deux-pieces",
    title: "Ensemble sport femme deux pieces respirant, top fit et legging taille haute, collection activewear OEM",
    shortTitle: "Ensemble sport femme activewear",
    keywords: ["habit", "vetement", "ensemble", "legging", "sport", "activewear", "fashion", "clothes"],
    image: "/products/fashion-activewear.svg",
    gallery: [
      "/products/fashion-activewear.svg",
      "/products/fashion-activewear.svg",
      "/products/fashion-activewear.svg"
    ],
    packaging: "Zip bag premium + carton export",
    itemWeightGrams: 340,
    lotCbm: "0.098 m3 / lot de 80 sets",
    minUsd: 7.42,
    maxUsd: 9.28,
    moq: 80,
    unit: "sets",
    badge: "Promo",
    supplierName: "Yiwu Motion Fit Garments Co., Ltd.",
    supplierLocation: "Zhejiang, China",
    responseTime: "≤ 5 h",
    yearsInBusiness: 5,
    transactionsLabel: "96 collections activewear expédiées",
    soldLabel: "Très demandé sur segments fitness et mode sport",
    customizationLabel: "Coloris capsules, logo heat transfer, packaging marque privée",
    shippingLabel: "Réassort rapide sur tailles standard",
    overview: [
      "Set activewear respirant avec top court fit et legging sculptant.",
      "Tissu stretch doux pensé pour sport, yoga, fitness et lifestyle.",
      "Positionnement mode sport idéal pour boutiques, live selling et collection capsules.",
      "Produit prêt pour branding OEM, packaging premium et drops rapides."
    ],
    variantGroups: [
      { label: "Couleur", values: ["Lavande", "Noir carbone", "Rose sable"] },
      { label: "Taille", values: ["S", "M", "L"] },
      { label: "Finition", values: ["Sans logo", "Heat transfer", "Étiquette tissée"] }
    ],
    tiers: [
      { quantityLabel: "80-199 sets", priceUsd: 9.28, note: "Collection test" },
      { quantityLabel: "200-499 sets", priceUsd: 8.16, note: "Marque privée" },
      { quantityLabel: "500+ sets", priceUsd: 7.42, note: "Volume sportwear" }
    ],
    specs: [
      { label: "Tissu", value: "Nylon + spandex" },
      { label: "Style", value: "Ensemble 2 pièces activewear" },
      { label: "Respirabilité", value: "Séchage rapide" },
      { label: "Usage", value: "Fitness, yoga, sport lifestyle" },
      { label: "Poids", value: "340 g" },
      { label: "Délai", value: "6 à 10 jours" }
    ]
  }
];

export const historyProductSlugs = products.map((product) => product.slug);

export const recommendationProductSlugs = [
  "fauteuil-gaming-rgb-oem-luxe",
  "combo-clavier-souris-onikuma-rgb",
  "bureau-gaming-fibre-carbone-led",
  "lunettes-vr-3d-metavers-hifi"
];

export const discoveryHistorySlugs = [
  "souris-gaming-g502x-rgb-usb",
  "lunettes-vr-3d-metavers-hifi",
  "bureau-gaming-fibre-carbone-led"
];

export const discoveryExploreGroups = [
  {
    id: "explore-piercing",
    title: "Explorez d'autres",
    subtitle: "Bijoux de piercing tendance",
    items: [
      { slug: "piercing-g23-titane-zircon", priceUsd: 1.8 },
      { slug: "piercing-g23-titane-zircon", priceUsd: 2.93 },
      { slug: "bean-bag-gaming-oxford", priceUsd: 1.64 },
      { slug: "lunettes-vr-3d-metavers-hifi", priceUsd: 3.77 }
    ]
  },
  {
    id: "explore-vr",
    title: "Explorez d'autres",
    subtitle: "Equipements de realite virtuelle",
    items: [
      { slug: "machine-vr-9d-moviepower", priceUsd: 5764.1 },
      { slug: "bureau-gaming-fibre-carbone-led", priceUsd: 5239.21 },
      { slug: "lunettes-vr-3d-metavers-hifi", priceUsd: 120521 },
      { slug: "combo-clavier-souris-onikuma-rgb", priceUsd: 2270.71 }
    ]
  }
];

export function getProductBySlug(slug: string) {
  return products.find((product) => product.slug === slug) ?? null;
}

export function getProductsBySlugs(slugs: string[]) {
  return slugs
    .map((slug) => getProductBySlug(slug))
    .filter((product): product is ProductCatalogItem => product !== null);
}

export function getRelatedProducts(currentSlug: string, limit = 4) {
  return products.filter((product) => product.slug !== currentSlug).slice(0, limit);
}

export function searchProducts(query: string, limit?: number) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return [];
  }

  const rankedResults = products
    .map((product) => {
      const haystack = [
        product.title,
        product.shortTitle,
        ...(product.keywords ?? []),
        product.supplierName,
        product.customizationLabel,
        product.shippingLabel,
        product.packaging,
        ...product.overview,
        ...product.specs.map((spec) => `${spec.label} ${spec.value}`),
        ...product.variantGroups.flatMap((group) => [group.label, ...group.values]),
      ]
        .join(" ")
        .toLowerCase();

      if (!haystack.includes(normalizedQuery)) {
        return null;
      }

      let score = 0;

      if (product.shortTitle.toLowerCase().includes(normalizedQuery)) {
        score += 8;
      }
      if (product.title.toLowerCase().includes(normalizedQuery)) {
        score += 6;
      }
      if (product.slug.toLowerCase().includes(normalizedQuery)) {
        score += 4;
      }
      if (product.overview.some((entry) => entry.toLowerCase().includes(normalizedQuery))) {
        score += 3;
      }
      if (product.specs.some((spec) => `${spec.label} ${spec.value}`.toLowerCase().includes(normalizedQuery))) {
        score += 2;
      }

      return { product, score };
    })
    .filter((entry): entry is { product: ProductCatalogItem; score: number } => entry !== null)
    .sort((left, right) => right.score - left.score);

  const results = rankedResults.map((entry) => entry.product);
  return typeof limit === "number" ? results.slice(0, limit) : results;
}

const defaultSearchSuggestions = [
  "souris sans fil",
  "souris gamer",
  "souris ergonomique",
  "bureau gaming",
  "fauteuil gaming",
  "combo clavier souris",
  "tapis gaming RGB",
  "casque VR",
  "lunettes VR 3D",
  "machine arcade VR",
  "hoodie streetwear",
  "ensemble activewear",
  "piercing titane",
];

export const searchSuggestions = Array.from(
  new Set(
    [
      ...defaultSearchSuggestions,
      ...products.flatMap((product) => [product.shortTitle, ...(product.keywords ?? [])]),
    ].map((entry) => entry.trim()),
  ),
);

export function getSearchSuggestions(query: string, limit = 8) {
  const normalizedQuery = query.trim().toLowerCase();

  const rankedSuggestions = searchSuggestions
    .map((suggestion) => {
      const normalizedSuggestion = suggestion.toLowerCase();

      if (!normalizedQuery) {
        return { suggestion, score: 0 };
      }

      if (!normalizedSuggestion.includes(normalizedQuery)) {
        return null;
      }

      let score = 0;

      if (normalizedSuggestion === normalizedQuery) {
        score += 12;
      }
      if (normalizedSuggestion.startsWith(normalizedQuery)) {
        score += 8;
      }
      if (normalizedSuggestion.includes(` ${normalizedQuery}`)) {
        score += 5;
      }

      return { suggestion, score };
    })
    .filter((entry): entry is { suggestion: string; score: number } => entry !== null)
    .sort((left, right) => right.score - left.score || left.suggestion.localeCompare(right.suggestion));

  return rankedSuggestions.slice(0, limit).map((entry) => entry.suggestion);
}