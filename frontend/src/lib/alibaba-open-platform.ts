export type IntegrationStep = {
  title: string;
  detail: string;
};

export type ApiReferenceItem = {
  name: string;
  path: string;
  purpose: string;
  note?: string;
};

export type KeyValueReference = {
  key: string;
  value: string;
  detail?: string;
};

export type FieldReference = {
  name: string;
  type: string;
  required: string;
  description: string;
};

export type StatusReference = {
  code: string;
  label: string;
  detail: string;
};

export type ErrorReference = {
  code: string;
  title: string;
  cause: string;
  resolution: string;
};

export const openPlatformOverview = {
  environment: "oversea environment",
  authServiceAddress: "https://openapi-auth.alibaba.com",
  apiServiceAddress: "https://openapi-api.alibaba.com",
  prerequisites: [
    "Creer un compte developpeur GGS et faire approuver le profil.",
    "Enregistrer l'application dans la bonne categorie puis recuperer App Key et App Secret.",
    "Demander les groupes de permissions API necessaires avant tout appel metier.",
    "Configurer un callback HTTPS valide si les messages push doivent etre consommes.",
  ],
  integrationTopics: [
    "Seller authorization",
    "Buyer authorization",
    "HTTP request signing",
    "Order list, order detail, payment fund query, logistics query",
    "Shipping APIs simple et multi-batch",
    "Push notifications produit et commande",
    "Category tree, category mapping et schema par niveau",
    "Photobank, image upload et groupes media",
    "Product list, product get, inventory, display status",
    "Schema add, update, render, draft et quality score",
  ],
};

export const authTokenEndpointNotes: KeyValueReference[] = [
  { key: "/auth/token/create", value: "code requis, uuid ignore", detail: "Le champ uuid est documente comme invalide actuellement et ne doit pas etre utilise." },
  { key: "Create response", value: "account_id, country, user_info, account_platform", detail: "Le retour contient aussi account, access_token, refresh_token, expires_in et refresh_expires_in." },
  { key: "/auth/token/refresh", value: "refresh_token requis", detail: "La doc fournie mentionne l'endpoint auth.lazada.com/rest; le payload de retour reste du meme format que create token." },
  { key: "seller_center", value: "account_id peut etre null", detail: "Quand account_platform = seller_center, account_id peut etre null selon la doc." },
];

export const permissionRequestSteps: IntegrationStep[] = [
  {
    title: "Ouvrir App Overview",
    detail: "Aller dans la section API Permission Group et identifier les groupes actifs et inactifs.",
  },
  {
    title: "Verifier le besoin metier",
    detail: "Ouvrir chaque groupe pour connaitre les APIs incluses et choisir uniquement celles utiles au scenario dropshipping, order, shipping ou sourcing.",
  },
  {
    title: "Appliquer les droits",
    detail: "Cliquer sur Apply, decrire le scenario business et joindre un document si le support le demande.",
  },
  {
    title: "Attendre l'activation",
    detail: "Sans permission active, les appels seront rejetes par la gateway meme si la signature est correcte.",
  },
];

export const importToStoreFlow: IntegrationStep[] = [
  {
    title: "Voir la fiche produit",
    detail: "L'utilisateur navigue sur une fiche produit Alibaba eligible a l'import magasin.",
  },
  {
    title: "Cliquer sur Add to my store",
    detail: "Alibaba ouvre le popup de choix d'outil puis redirige vers le site du partenaire.",
  },
  {
    title: "Verifier le compte",
    detail: "Si le compte n'est pas relie, il faut lancer le compte linking OAuth avant de poursuivre.",
  },
  {
    title: "Recuperer et sauver le produit",
    detail: "Le partenaire recupere les details produit et l'enregistre dans sa liste d'import.",
  },
  {
    title: "Editer puis importer en boutique",
    detail: "Le marchand ajuste les donnees produit puis l'importe dans sa boutique avant la phase de commande.",
  },
  {
    title: "Recevoir la commande et passer l'ordre Alibaba",
    detail: "Le flux se prolonge avec freight verification, create order, payment et suivi logistique.",
  },
];

export const sellerAuthorizationFlow: IntegrationStep[] = [
  {
    title: "Construire l'URL d'autorisation",
    detail: "Utiliser /oauth/authorize avec response_type=code, redirect_uri et client_id=appkey.",
  },
  {
    title: "Guider le vendeur",
    detail: "Le vendeur se connecte avec son compte Global Gold Seller et autorise l'application.",
  },
  {
    title: "Recuperer le code",
    detail: "Le callback recoit un code OAuth valable 30 minutes.",
  },
  {
    title: "Echanger le code contre un token",
    detail: "Appeler /auth/token/create pour obtenir access_token et refresh_token.",
  },
  {
    title: "Sauvegarder et rafraichir",
    detail: "Conserver le dernier refresh_token et renouveler l'access_token environ 30 minutes avant expiration si refresh_expires_in > 0.",
  },
];

export const buyerAuthorizationFlow: IntegrationStep[] = [
  {
    title: "Meme endpoint OAuth",
    detail: "L'autorisation buyer utilise aussi https://openapi-auth.alibaba.com/oauth/authorize.",
  },
  {
    title: "Connexion buyer",
    detail: "Le buyer s'authentifie sur le site MY puis autorise l'application.",
  },
  {
    title: "Code vers token",
    detail: "Le code de callback est echange via /auth/token/create.",
  },
  {
    title: "Stockage du token",
    detail: "Le token doit etre stocke cote serveur; si refresh_expires_in = 0 il faudra re-autoriser.",
  },
];

export const tokenFields: KeyValueReference[] = [
  { key: "access_token", value: "string", detail: "Token d'acces pour les APIs qui demandent l'autorisation vendeur ou buyer." },
  { key: "refresh_token", value: "string", detail: "Token a sauvegarder pour renouveler l'access token." },
  { key: "expire_time", value: "number", detail: "Timestamp d'expiration de l'access token." },
  { key: "refresh_token_valid_time", value: "number", detail: "Timestamp d'expiration du refresh token." },
  { key: "expires_in", value: "number", detail: "Duree de validite restante du token courant." },
  { key: "refresh_expires_in", value: "number", detail: "Si 0, le token n'est plus rafraichissable." },
  { key: "seller_id / buyer_id", value: "string", detail: "Identifiant metier du compte autorise selon le scenario." },
  { key: "user_id / havana_id", value: "string", detail: "Pour les migrations historiques, user_id de l'ancienne plateforme correspond a havana_id." },
  { key: "account_platform", value: "seller_center | buyApp", detail: "Plateforme source du compte relie." },
  { key: "account", value: "email", detail: "Compte relie a la session OAuth." },
];

export const requestSigningFields: FieldReference[] = [
  { name: "app_key", type: "String", required: "Yes", description: "Identifiant public de l'application." },
  { name: "access_token", type: "String", required: "Conditional", description: "Necessaire sur les APIs qui exigent une autorisation vendeur ou buyer." },
  { name: "timestamp", type: "String", required: "Yes", description: "Heure de la requete en UTC ou format digital; ecart max recommande: 7200 secondes." },
  { name: "sign_method", type: "String", required: "Yes", description: "Signature basee sur HMAC_SHA256." },
  { name: "sign", type: "String", required: "Yes", description: "Signature HEX de la requete concatenee et signee." },
];

export const requestSigningSteps: IntegrationStep[] = [
  {
    title: "Renseigner les parametres",
    detail: "Ajouter tous les parametres systeme et business; ne pas inclure sign lui-meme dans la base de calcul.",
  },
  {
    title: "Trier ASCII",
    detail: "Trier les paires cle/valeur par nom de parametre selon l'ordre ASCII.",
  },
  {
    title: "Concatener cle + valeur",
    detail: "Assembler une chaine continue du type app_key123codeXYZtimestamp...",
  },
  {
    title: "Prefixer par l'API path",
    detail: "Ajouter par exemple /auth/token/create devant la chaine concatenee.",
  },
  {
    title: "Signer en HMAC_SHA256",
    detail: "Signer avec l'App Secret puis convertir le digest en hexadecimal majuscule pour l'appel HTTP classique.",
  },
  {
    title: "Construire la requete REST",
    detail: "Encoder en UTF-8 et utiliser GET si l'URL est courte; sinon POST. L'SDK officiel gere toute cette etape automatiquement.",
  },
];

export const essentialApis: ApiReferenceItem[] = [
  { name: "Create token", path: "/auth/token/create", purpose: "Obtenir access_token et refresh_token depuis le code OAuth." },
  { name: "Refresh token", path: "/auth/token/refresh", purpose: "Renouveler l'access_token a partir du refresh token courant." },
  { name: "Order list", path: "/alibaba/order/list", purpose: "Lister les trade_id par date, modification ou statut." },
  { name: "Order detail", path: "/alibaba/order/get", purpose: "Lire le detail complet d'une commande." },
  { name: "Order fund query", path: "/alibaba/order/fund/query", purpose: "Recuperer les informations de paiement d'une commande payee." },
  { name: "Order logistics query", path: "/order/logistics/query", purpose: "Lire tracking et etat logistique d'une commande." },
  { name: "Single shipping", path: "/alibaba/v2/order/shipping", purpose: "Declarer une expedition simple." },
  { name: "Multi shipping", path: "/alibaba/order/v2/multi/shipping", purpose: "Declarer une expedition en plusieurs batches ou plusieurs SKUs." },
  { name: "Shipping channels", path: "alibaba.seller.order.shipping.channels", purpose: "Charger les transporteurs et les valeurs code a injecter dans service_provider." },
  { name: "Picture upload", path: "alibaba.order.picture.upload", purpose: "Uploader les pieces jointes ou etiquettes avant l'appel shipping." },
  { name: "Order webhook", path: "ICBU_TRADE_SYNC_MSG / ICBU ORDER SYNC MESSAGE", purpose: "Recevoir les changements d'etat en push et re-puller le detail par ordre si besoin." },
];

export const categoryApis: ApiReferenceItem[] = [
  { name: "Category tree", path: "/icbu/product/category/get", purpose: "Charger l'arbre des categories; cat_id=0 retourne les categories de premier niveau.", note: "Requiert accessToken selon l'exemple SDK fourni." },
  { name: "Category ID mapping", path: "/alibaba/icbu/category/id/mapping", purpose: "Mapper ancienne et nouvelle categorie, attribut ou valeur via convert_type 1/2/3." },
  { name: "Schema level get", path: "/icbu/product/schema/level/get", purpose: "Retourner les sous-proprietes d'un schema hierarchique a partir d'un XML partiel et d'une langue." },
  { name: "Schema get", path: "/alibaba/icbu/product/schema/get", purpose: "Recuperer les regles et champs de publication pour un nouveau produit sur une categorie donnee." },
  { name: "Product type available", path: "/icbu/product/other/available/get", purpose: "Verifier si le marchand peut publier wholesale ou sourcing pour une categorie." },
  { name: "Legacy publish rules", path: "/icbu/product", purpose: "Endpoint plus ancien pour recuperer des regles de publication produit." },
];

export const photobankApis: ApiReferenceItem[] = [
  { name: "Photobank group list", path: "/icbu/product/photobank/group/list", purpose: "Lister les groupes d'images par groupe parent." },
  { name: "Photobank group operate", path: "/icbu/product/photobank/group/operate", purpose: "Ajouter, supprimer ou renommer un groupe photobank." },
  { name: "Photobank list", path: "/icbu/product/photobank/list", purpose: "Lister les images d'un groupe avec pagination." },
  { name: "Photobank upload", path: "/alibaba/icbu/photobank/upload", purpose: "Uploader une image brute dans le photobank avec file_name, image_bytes et group_id optionnel." },
  { name: "Product group add", path: "/icbu/product/group/add", purpose: "Creer un groupe produit et structurer le catalogue marchand sur plusieurs niveaux." },
];

export const inventoryAndProductApis: ApiReferenceItem[] = [
  { name: "Encrypt product ID", path: "/alibaba/icbu/product/id/encrypt", purpose: "Convertir un product_id non chiffre en secret_id exploitable par certains flux." },
  { name: "Product get", path: "/icbu/product/get", purpose: "Recuperer le detail produit complet, y compris SKU, sourcing_trade, wholesale_trade et attributs." },
  { name: "Product list", path: "/alibaba/icbu/product/list", purpose: "Lister les produits par categorie, subject, groupe et fenetre gmt_modified avec pagination max 30." },
  { name: "Inventory get", path: "/icbu/product/inventory/get", purpose: "Lire l'inventaire par sku_id et inventory_code." },
  { name: "Inventory update", path: "/icbu/product/inventory/update", purpose: "Mettre a jour l'inventaire via inventory_list et operation plus/minus." },
  { name: "Update display", path: "/icbu/product/update/display", purpose: "Mettre on/off l'affichage produit par lot." },
  { name: "Score get", path: "/icbu/product/score/get", purpose: "Consulter le score qualite produit et boutique_tag." },
];

export const productSchemaApis: ApiReferenceItem[] = [
  { name: "Schema add", path: "/icbu/product/schema/add", purpose: "Publier un nouveau produit ICBU depuis publish_request XML.", note: "Utiliser une leaf category et des images deja presentes dans le photobank du compte." },
  { name: "Schema add draft", path: "/icbu/product/schema/add/draft", purpose: "Creer un brouillon produit a partir du schema XML." },
  { name: "Schema render", path: "/icbu/product/schema/render", purpose: "Rendre les donnees existantes d'un produit pour edition." },
  { name: "Schema render draft", path: "/icbu/product/schema/render/draft", purpose: "Recuperer le contenu d'un brouillon produit unique." },
  { name: "Schema update", path: "/icbu/product/schema/update", purpose: "Mettre a jour de facon incrementale uniquement les champs XML transmis." },
];

export const productLifecycleSteps: IntegrationStep[] = [
  {
    title: "Choisir une leaf category",
    detail: "Commencer par category/get puis schema/get; la publication schema exige une categorie feuille valide.",
  },
  {
    title: "Verifier les permissions de publication",
    detail: "Utiliser other/available/get pour savoir si le compte supporte wholesale, sourcing ou ready-to-ship sur la categorie cible.",
  },
  {
    title: "Preparer les medias dans le photobank",
    detail: "Les images de description/detail doivent provenir du photobank du compte sinon schema/add et schema/update peuvent etre rejetes.",
  },
  {
    title: "Generer ou rendre le schema",
    detail: "Schema/get construit les champs; schema/render ou render/draft sert a recharger un produit existant ou un brouillon.",
  },
  {
    title: "Publier ou sauver en draft",
    detail: "Utiliser schema/add pour publier directement ou schema/add/draft pour stocker le brouillon avant revue humaine.",
  },
  {
    title: "Mettre a jour et monitorer",
    detail: "Utiliser schema/update, inventory/update, update/display et score/get pour maintenir le catalogue vivant.",
  },
];

export const photobankErrors: ErrorReference[] = [
  {
    code: "EC_IMAGE_U_ARG_VP",
    title: "Invalid member information",
    cause: "aliId absent ou accessToken invalide lors des appels group/list.",
    resolution: "Verifier le token autorise et l'identite du membre avant de rappeler l'API.",
  },
  {
    code: "EC_IMAGE_L_ARG_RQ",
    title: "Empty photobank params",
    cause: "Les parametres de requete sont vides.",
    resolution: "Renseigner au minimum le parent group id attendu ou les parametres obligatoires du point d'entree cible.",
  },
  {
    code: "-2",
    title: "Image query/upload transient error",
    cause: "TimeoutException, NetworkException ou erreur non predefinie sur photobank list/upload.",
    resolution: "Implementer un retry avec backoff pour les erreurs techniques transitoires.",
  },
  {
    code: "SIZE_TOO_LARGE",
    title: "Raw image too large",
    cause: "Le fichier depasse 5 MB a l'upload photobank.",
    resolution: "Compresser ou redimensionner l'image avant upload.",
  },
  {
    code: "FUNCTION_FORBIDDEN / NOCAPACITY",
    title: "Upload forbidden or photobank full",
    cause: "Compte bloque pour risque ou capacite media pleine.",
    resolution: "Contacter Alibaba developer support ou liberer de l'espace avant nouvel upload.",
  },
];

export const productPublishingErrors: ErrorReference[] = [
  {
    code: "CHK_CAT_NOT_LEAF / PUB_BIZCHECK_CAT_ID_NOTEXIST",
    title: "Invalid category selection",
    cause: "La categorie n'est pas une leaf category ou le cat_id est absent/invalide.",
    resolution: "Reprendre category/get et schema/get puis publier uniquement sur une categorie feuille valide.",
  },
  {
    code: "PUB_BIZCHECK_DESCRIPTION_IMAGE_SOURCE_ERROR",
    title: "Description image source invalid",
    cause: "Les images detaillees ne proviennent pas du photobank du compte.",
    resolution: "Uploader les images via photobank/upload puis reutiliser ces fileId / URLs dans le schema.",
  },
  {
    code: "PUB_BIZCHECK_PRODUCT_NOT_EDITABLE / PRODUCT_STATUS_INVALID",
    title: "Product not editable",
    cause: "Produit pending approval, deleted ou dans un statut bloque pour edition.",
    resolution: "Attendre l'approbation ou choisir un produit editable via render/render draft.",
  },
  {
    code: "PUB_BIZCHECK_ASSURANCE_ACCOUNT_REQUIRED / TEMPLATE_OWNER_ERROR",
    title: "Account or template not eligible",
    cause: "Trade assurance non ouvert ou shipping template non possede par le compte.",
    resolution: "Activer trade assurance et utiliser uniquement les templates du compte courant.",
  },
  {
    code: "PUB_BIZCHECK_PRODUCT_SKU_INVALID / PROPERTY_CUSTOM_NAME_DUPLICATE",
    title: "SKU or custom property invalid",
    cause: "SKU incomplets, doublons sur les proprietes ou custom attributes repetes.",
    resolution: "Verifier unicite des couples proprietes/valeurs et limiter les attributs custom a 10.",
  },
  {
    code: "CHK_BASIC_REQUIRED / ONEOF / MULTIPLEOF / MIN_LENGTH / MAX_LENGTH",
    title: "Schema field validation failed",
    cause: "Champ requis absent ou valeur hors contraintes d'options, de longueur ou de plage.",
    resolution: "Respecter strictement le XML retourne par schema/get et les options autorisees.",
  },
  {
    code: "CHK_STEP_CATEGORY_QUALITY_MINSIZE_ERROR / LADDER_PERIOD_VALUE_ERROR / RTS_MIN_ORDER_PERIOD_MAX_THAN_15_ERROR",
    title: "MOQ or ladder rules invalid",
    cause: "MOQ trop faible, ladder mal ordonne ou delai ready-to-ship superieur aux limites plateforme.",
    resolution: "Reordonner les paliers, respecter les minima par categorie et garder RTS <= 15 jours quand requis.",
  },
  {
    code: "PUB_BIZCHECK_AUDITING_COMPANY_INFO / SUSPICIOUS / SUSPICIOUS_CATEGORY",
    title: "Compliance or qualification block",
    cause: "Profil societe en revue, compte bloque pour risque ou categorie soumise a qualification speciale.",
    resolution: "Completer le profile company, corriger le risque/compliance et fournir la qualification speciale si necessaire.",
  },
  {
    code: "CHK_VIDEO_PRODUCT_LINK_LIMIT / CHK_DETAIL_VIDEO_PRODUCT_LINK_LIMIT",
    title: "Video link limit reached",
    cause: "Une video est reliee a trop de produits ou de descriptions.",
    resolution: "Limiter une video a 20 main images et 200 descriptions detail selon la doc fournie.",
  },
];

export const orderStatuses: StatusReference[] = [
  { code: "to_be_audited", label: "Waiting for audit", detail: "Commande creee en attente de revue." },
  { code: "intention_processing", label: "Intent order", detail: "Brouillon / intention en attente de generation vendeur." },
  { code: "unpay", label: "Waiting for advance payment", detail: "Le buyer n'a pas encore paye; verifier pay_step pour savoir s'il s'agit d'un acompte ou solde." },
  { code: "paying", label: "Buyer has paid but needs to verify", detail: "Paiement compris comme recu mais encore en traitement systeme." },
  { code: "paid", label: "Payment success", detail: "Le paiement est reconnu comme effectue." },
  { code: "captured", label: "Funds captured", detail: "Paiement finalise et fonds arrives." },
  { code: "relating", label: "TT relating", detail: "Le vendeur rapproche un paiement TT manuel avec la commande." },
  { code: "undeliver", label: "Waiting seller shipment", detail: "Commande payee, expeditiable cote ERP." },
  { code: "delivering", label: "Shipping in progress", detail: "Expedition lancee par le vendeur." },
  { code: "wait_confirm_receipt", label: "Waiting buyer receipt", detail: "Le buyer doit confirmer la reception." },
  { code: "trade_success", label: "Order completed", detail: "Commande terminee." },
  { code: "trade_close", label: "Order closed", detail: "Commande annulee ou fermee." },
  { code: "wait_confirm_modify", label: "Waiting contract modify confirmation", detail: "Modification du contrat apres paiement en attente d'accord buyer." },
  { code: "trade_unavailable", label: "Trade unavailable", detail: "Etat indisponible ou non exploitable." },
  { code: "charge_back", label: "Chargeback", detail: "Rejet carte bancaire, etat a intercepter cote ERP." },
  { code: "frozen", label: "Frozen", detail: "Commande gelee, souvent liee a un remboursement ou controle de risque." },
];

export const shippingSingleFields: FieldReference[] = [
  { name: "service_provider", type: "String", required: "Yes", description: "Code transporteur issu de l'API shipping channels, par exemple FEDEX." },
  { name: "logistics_type", type: "String", required: "Yes", description: "EXPRESS ou POST uniquement." },
  { name: "tracking_number", type: "String", required: "Yes", description: "Numero de suivi a remonter a Alibaba." },
  { name: "trade_id", type: "String", required: "Yes", description: "Numero Trade Assurance de la commande." },
  { name: "contact_mobile", type: "String", required: "Conditional", description: "Derniers 4 chiffres du mobile pour certains carriers comme J&T Express." },
  { name: "attachments", type: "Array", required: "Optional", description: "Liste des pieces jointes avec file_name et file_path obtenu via picture upload." },
];

export const shippingMultiFields: FieldReference[] = [
  { name: "service_provider", type: "String", required: "Yes", description: "Code transporteur retourne par shipping channels." },
  { name: "logistics_type", type: "String", required: "Yes", description: "EXPRESS ou POST." },
  { name: "tracking_number", type: "String", required: "Yes", description: "Numero de tracking du batch." },
  { name: "trade_id", type: "String", required: "Yes", description: "Commande cible." },
  { name: "contact_mobile", type: "String", required: "Conditional", description: "Suffixe mobile si requis par le carrier." },
  { name: "goods[].product_id", type: "String", required: "Yes", description: "skuId du produit expedie." },
  { name: "goods[].quantity", type: "Positive integer", required: "Yes", description: "Quantite a expedier; ne doit pas depasser le shippable qty." },
  { name: "attachments", type: "Array", required: "Optional", description: "Documents ou etiquettes uploadees prealablement." },
];

export const shippingRules: IntegrationStep[] = [
  {
    title: "Charger les carriers d'abord",
    detail: "Toujours appeler shipping.channels avant de renseigner service_provider pour recuperer le code exact du transporteur.",
  },
  {
    title: "Uploader les pieces separement",
    detail: "Les file_path des attachments doivent venir de alibaba.order.picture.upload.",
  },
  {
    title: "Verifier le role operateur",
    detail: "Seul l'utilisateur qui est a la fois shipper et operator peut lancer l'expedition.",
  },
  {
    title: "Support multi-batch",
    detail: "Utiliser goods[] quand plusieurs SKU ou expeditions partielles doivent etre soumises.",
  },
];

export const orderErrors: ErrorReference[] = [
  {
    code: "110001",
    title: "Unauthorized Buyer",
    cause: "Le buyer utilise un compte CNFM non autorise a transacter dans ce scenario.",
    resolution: "Faire utiliser un compte overseas IFM et guider le choix du pays d'inscription.",
  },
  {
    code: "10010 / 4028",
    title: "Logistics route not found",
    cause: "dispatch_location ou route de livraison incoherente entre freight et create order.",
    resolution: "Aligner dispatch_location sur les appels de freight et de commande; US pour stock US, MX pour stock Mexique.",
  },
  {
    code: "130602 / 130608",
    title: "Invalid logistics route",
    cause: "carrier ou dispatch_location devenu invalide, souvent sur les produits stock overseas.",
    resolution: "Recharger les routes de livraison et verifier le pays de dispatch avant la creation.",
  },
  {
    code: "480006",
    title: "Order amount exceeds limit",
    cause: "Le montant depasse la limite TAD open scenario de 5000 USD.",
    resolution: "Reduire le panier ou diviser la commande.",
  },
  {
    code: "10007 / 410006",
    title: "MOQ not satisfied",
    cause: "La quantite demandee est sous le MOQ du produit.",
    resolution: "Relire le MOQ sur la fiche PC et augmenter la quantite.",
  },
  {
    code: "130106 / 130703 / 130704",
    title: "Product or inventory invalid",
    cause: "Produit hors ligne, cache promo obsolete ou stock insuffisant.",
    resolution: "Recharger la fiche produit, verifier le SKU et la disponibilite avant verification/order create.",
  },
  {
    code: "120019 / 4015 / 10012",
    title: "Destination or dispatch restriction",
    cause: "Le produit ne peut pas etre livre ou expedie depuis le pays indique.",
    resolution: "Verifier les restrictions pays, la route logistique et le dispatch_location du stock overseas.",
  },
  {
    code: "800022",
    title: "Tax calculation failed",
    cause: "Adresse incomplète pour le calcul fiscal ou tarifaire.",
    resolution: "Renseigner countryCode, province, city, zip et adresse complete.",
  },
  {
    code: "430013",
    title: "Order amount too small",
    cause: "Montant total inferieur a 0.3.",
    resolution: "Augmenter la valeur du panier avant create order.",
  },
  {
    code: "400007",
    title: "German/French EPR interception",
    cause: "Le marchand n'a pas encore un numero EPR valide pour le pays cible.",
    resolution: "Attendre la validation EPR puis retenter apres propagation.",
  },
];

export const callbackMessages: ApiReferenceItem[] = [
  {
    name: "Product option message",
    path: "PRODUCT_OPTION_TAG",
    purpose: "ADD ou DELETE d'un produit devenu listable ou delistable.",
  },
  {
    name: "Product change message",
    path: "PRODUCT_CHANGE_TAG",
    purpose: "Signale surtout un changement de prix; il faut recharger la fiche complete apres reception.",
  },
  {
    name: "Order sync message",
    path: "ICBU_TRADE_SYNC_MSG / ICBU ORDER SYNC MESSAGE",
    purpose: "Push des changements de statut commande; utiliser trade_id pour puller le detail complet.",
  },
];

export const callbackRequirements: IntegrationStep[] = [
  {
    title: "HTTPS obligatoire",
    detail: "Le callback doit etre expose en HTTPS avec certificat CA; self-signed et DV non supportes selon la doc fournie.",
  },
  {
    title: "Verifier Authorization",
    detail: "Recalculer la signature HMAC-SHA256 a partir de AppKey + raw body, puis comparer au header Authorization.",
  },
  {
    title: "Repondre tres vite",
    detail: "Retourner HTTP 200 OK en moins de 500 ms pour eviter les retries; mettre le traitement metier dans une queue.",
  },
  {
    title: "Prevoir l'idempotence",
    detail: "Le push est at-least-once; des doublons peuvent apparaitre et doivent etre dedupes cote application.",
  },
  {
    title: "Surveiller le taux d'echec",
    detail: "Au-dela de 50% d'echecs de push, la plateforme peut stopper l'envoi vers l'URL concernee.",
  },
];

export const callbackSignatureGuide: KeyValueReference[] = [
  { key: "Base", value: "{AppKey}{rawMessageBody}", detail: "Utiliser le body JSON brut recu, sans reserialisation." },
  { key: "Secret", value: "{AppSecret}", detail: "Le meme App Secret que pour les appels API." },
  { key: "Algorithm", value: "HMAC-SHA256", detail: "Le resultat doit etre encode en hexadecimal lowercase pour le callback selon l'exemple fourni." },
  { key: "Header compare", value: "Authorization", detail: "Comparer la signature calculee au header d'entree avant toute logique metier." },
];

export const sourcingWorkflow: IntegrationStep[] = [
  {
    title: "Connecter le buyer",
    detail: "Le sourcing partner doit s'assurer que le buyer possede un compte Alibaba actif puis realise le linking OAuth.",
  },
  {
    title: "Activer la recherche enrichie",
    detail: "Combiner Channel Product Upload, Image Search, Similar Products, Bought Together et Catalog API pour la decouverte produit.",
  },
  {
    title: "Verifier la commande",
    detail: "Avant create order, verifier prix, stock et shipping via les APIs de verification et freight.",
  },
  {
    title: "Creer puis payer",
    detail: "Enchainer OrderCreation API, OrderPayment API puis GetOrder / logistics tracking pour le suivi.",
  },
  {
    title: "Gerer les retours",
    detail: "Les OrderReturn APIs couvrent la demande de retour, le remboursement et le suivi retour.",
  },
];

export const productIntelligenceApis: ApiReferenceItem[] = [
  {
    name: "Category prediction v2",
    path: "/alibaba/icbu/category/predict/v2",
    purpose: "Predire automatiquement une categorie a partir du title, de la description et optionnellement d'une image.",
    note: "title est obligatoire; erreur metier documentee: B_CATEGORY_PREDICT_FAIL.",
  },
  {
    name: "Category get v2",
    path: "/alibaba/icbu/category/get/v2",
    purpose: "Lister les categories de niveau 1 ou les sous-categories d'un parent_category_id donne.",
    note: "Si parent_category_id pointe sur une leaf category, l'erreur BUSINESS_CATEGORY_NOT_EXIST est attendue.",
  },
  {
    name: "Category attribute get v2",
    path: "/alibaba/icbu/category/attribute/get/v2",
    purpose: "Recuperer les general attributes et sale attributes d'une leaf category pour composer product_info.",
  },
  {
    name: "Shipping templates list",
    path: "/alibaba/icbu/product/list/shipping/templates",
    purpose: "Lister les templates d'expedition disponibles avant listing ou update produit.",
  },
];

export const productListingV2Apis: ApiReferenceItem[] = [
  {
    name: "Create listing v2",
    path: "/alibaba/icbu/product/listing/v2",
    purpose: "Creer un nouveau listing avec product_info structure et option d'optimisation IA du titre, de la description et des keywords.",
  },
  {
    name: "Update product v2",
    path: "/alibaba/icbu/product/update/v2",
    purpose: "Mettre a jour un produit en renvoyant un product_info complet incluant category_info, basic_info, trade_info et logistics_info.",
  },
  {
    name: "Get product v2",
    path: "/alibaba/icbu/product/get/v2",
    purpose: "Recuperer product_info par product_id ou sku_id, y compris audit_status, status, sku_info et logistics_info.",
  },
  {
    name: "Search product v2",
    path: "/alibaba/icbu/product/search/v2",
    purpose: "Rechercher par model_number ou sku_code avec pagination max 20.",
  },
  {
    name: "Product status get v2",
    path: "/alibaba/icbu/product/status/get/v2",
    purpose: "Recuperer le statut courant d'un listing: online, draft, failed ou pending, avec status_desc.",
  },
];

export const productBulkOperationApis: ApiReferenceItem[] = [
  {
    name: "Batch update status",
    path: "/alibaba/icbu/product/batch/update/status",
    purpose: "Basculer plusieurs produits online ou offline et recuperer errors[] pour les echecs partiels.",
  },
  {
    name: "Delete draft",
    path: "/alibaba/icbu/draft/delete",
    purpose: "Supprimer plusieurs brouillons par product_id_list et verifier deleted_draft_ids.",
  },
  {
    name: "Delete product",
    path: "/alibaba/icbu/product/delete",
    purpose: "Supprimer plusieurs produits publies ou existants via product_id_list.",
  },
  {
    name: "Edit inventory",
    path: "/icbu/product/edit-inventory",
    purpose: "Mettre a jour soit le stock SPU, soit les stocks SKU, mais jamais les deux simultanement.",
  },
  {
    name: "Edit price",
    path: "/icbu/product/edit-price",
    purpose: "Mettre a jour soit le pricing SPU, soit le pricing SKU; supporte tiered et range pricing cote SPU.",
  },
];

export const listingV2Workflow: IntegrationStep[] = [
  {
    title: "Predire puis confirmer la categorie",
    detail: "Commencer avec category/predict/v2 pour pre-remplir category_id, puis confirmer avec category/get/v2 et attribute/get/v2 avant listing.",
  },
  {
    title: "Assembler product_info proprement",
    detail: "Construire category_info, basic_info, trade_info et logistics_info avec valeurs uniques, images valides, shipping_template_id et lead times coherents.",
  },
  {
    title: "Activer l'IA si les contenus sont incomplets",
    detail: "ai_optimization_config peut optimiser title, description et keywords; utile quand keywords n'existent pas encore.",
  },
  {
    title: "Verifier le statut de sortie",
    detail: "Apres creation ou update, lire product/status/get/v2 pour savoir si le listing est online, draft, pending ou failed.",
  },
  {
    title: "Maintenir le catalogue en bulk",
    detail: "Utiliser batch/update/status, edit-price, edit-inventory, search/v2, get/v2 et delete draft/product pour l'exploitation quotidienne.",
  },
];

export const listingV2Errors: ErrorReference[] = [
  {
    code: "B_CATEGORY_PREDICT_FAIL",
    title: "Category prediction failed",
    cause: "Le moteur de prediction n'arrive pas a determiner une categorie valide depuis le titre, la description ou l'image.",
    resolution: "Verifier les entrees produit et retenter avec un title plus explicite et une image exploitable.",
  },
  {
    code: "B_PRODUCT_PARAM_INVALID / B_TITLE_NOT_FOUND / B_KEYWORD_NOT_FOUND",
    title: "Missing or invalid product payload",
    cause: "Le payload product_info est incomplet ou incoherent, notamment title, keywords ou identifiants requis.",
    resolution: "Completer le strict minimum requis; si keywords sont absents, activer keyword optimization quand possible.",
  },
  {
    code: "B_PRICE_ALL_NULL / B_PRICE_CONFLICT / B_MIN_PRICE_RANGE_INVALID / B_PRICE_SEQUENCE_INVALID / B_PRICE_SCALE_INVALID",
    title: "Pricing payload invalid",
    cause: "Prix SPU et SKU absents ensemble, conflit SPU/SKU, min/max inverses, tiers dupliques ou format decimal invalide.",
    resolution: "Choisir une seule strategie de prix par appel et garder des montants a deux decimales max, avec tiers ordonnes et uniques.",
  },
  {
    code: "B_INVENTORY_ALL_NULL / B_INVENTORY_CONFLICT",
    title: "Inventory payload invalid",
    cause: "Aucun stock transmis ou bien stock SPU et sku_inventory envoyes en meme temps.",
    resolution: "Mettre a jour soit inventory, soit sku_inventory uniquement.",
  },
  {
    code: "B_CONTAINS_INVALID_IMAGE / B_IMAGE_UPLOAD_FAILED",
    title: "Image payload invalid",
    cause: "Les URLs d'image sont invalides ou toutes les images ont echoue a l'upload.",
    resolution: "Verifier l'accessibilite des URLs et preparer des visuels propres avant listing.",
  },
  {
    code: "B_PRODUCT_INFO_TRANSLATION_FAILED",
    title: "Translation rate limit hit",
    cause: "Le service de traduction en amont du listing a depasse sa limite.",
    resolution: "Retenter plus tard ou fournir le contenu deja pretraduit.",
  },
  {
    code: "B_PRODUCT_NOT_FOUND / S_PRODUCT_SEARCH_ERROR",
    title: "Search or fetch failed",
    cause: "Produit introuvable ou service de recherche indisponible sur search/v2 ou get/v2.",
    resolution: "Verifier product_id, sku_id, model_number ou sku_code puis retenter en cas de panne technique.",
  },
];

export const listingV2PayloadNotes: KeyValueReference[] = [
  { key: "category_info", value: "category_name + category_id + attributes[]", detail: "Les attributs doivent etre nettoyes; eviter les doublons attribute_name/attribute_value." },
  { key: "basic_info", value: "title, description, language, product_image[]", detail: "Les images doivent etre valides; title est requis pour predict et listing." },
  { key: "trade_info", value: "unit, moq, inventory, sku_info, price", detail: "sku_info doit rester coherent avec les sale_attributes et sku_code uniques." },
  { key: "logistics_info", value: "shipping_template_id, lead times, weight, desi, dimension", detail: "Les templates peuvent etre precharges via product/list/shipping/templates." },
  { key: "ai_optimization_config", value: "title / description / keyword optimization", detail: "Optionnelle sur listing/v2, utile pour enrichir un produit brut avant publication." },
];

export const videoBankApis: ApiReferenceItem[] = [
  {
    name: "Video query",
    path: "/alibaba/icbu/video/query",
    purpose: "Lister les videos du marchand avec pagination, statut, duree, qualite et URLs media.",
  },
  {
    name: "Video upload",
    path: "/alibaba/icbu/video/upload",
    purpose: "Uploader une video dans le videobank a partir d'une URL source et d'un nom de video.",
    note: "Le retour expose req_id, req_code (COMPLETE/QUEUE/FAIL) et video_id.",
  },
  {
    name: "Video upload result",
    path: "/alibaba/icbu/video/upload/result",
    purpose: "Poller l'etat d'upload a partir du req_id retourne par video/upload.",
  },
  {
    name: "Relation product main video",
    path: "/alibaba/icbu/video/relation/product/main",
    purpose: "Associer une video comme main video d'un produit via video_id et product_id.",
  },
];

export const ecoBuyerCatalogApis: ApiReferenceItem[] = [
  {
    name: "Upload product",
    path: "/eco/buyer/item/add",
    purpose: "Soumettre un produit ISV a Alibaba.com et obtenir un item_id pour les requetes futures.",
  },
  {
    name: "Update product",
    path: "/eco/buyer/item/update",
    purpose: "Mettre a jour un produit deja partage avec Alibaba.com via updateReq.",
  },
  {
    name: "Retrieve uploaded items",
    path: "/eco/buyer/item/query",
    purpose: "Recuperer les produits deja pousses a Alibaba.com avec pagination et variations.",
  },
  {
    name: "Remove product",
    path: "/eco/buyer/item/delete",
    purpose: "Supprimer un produit precedemment partage via deleteReq.",
  },
  {
    name: "Channel product events",
    path: "/eco/buyer/product/events",
    purpose: "Notifier le statut ACTIVE/INACTIVE et le prix courant depuis un canal externe.",
  },
  {
    name: "Channel batch import by EcoId",
    path: "/eco/buyer/product/channel/batch-import",
    purpose: "Importer en masse dans une channel store par ecologyId de facon asynchrone.",
    note: "Le retour fournit pending_count et site_id pour le suivi d'import.",
  },
];

export const ecoBuyerDiscoveryApis: ApiReferenceItem[] = [
  {
    name: "Product list",
    path: "/eco/buyer/product/check",
    purpose: "Lister des product_ids Alibaba en melangeant local US/MX et cross-border CN selon le scenario.",
  },
  {
    name: "Cross-border product list",
    path: "/eco/buyer/crossborder/product/check",
    purpose: "Retourner les product_ids disposant de stock cross-border.",
  },
  {
    name: "Local product list",
    path: "/eco/buyer/local/product/check",
    purpose: "Retourner les produits avec stock overseas local.",
  },
  {
    name: "Local regular fulfillment",
    path: "/eco/buyer/localregular/product/check",
    purpose: "Retourner les produits avec stock overseas sur le scenario regular fulfillment.",
  },
  {
    name: "Product search",
    path: "/eco/buyer/product/search",
    purpose: "Rechercher des produits Alibaba avec pagination et retour titres, images, prix et permalinks.",
  },
  {
    name: "Search & recommendation by item",
    path: "/eco/buyer/item/rec",
    purpose: "Generer recherche et recommandations a partir d'un item_id ISV deja uploade.",
  },
  {
    name: "Image recommendation search",
    path: "/eco/buyer/item/rec/image",
    purpose: "Lancer une recherche image a partir d'un item_id et retourner des produits similaires.",
  },
];

export const ecoBuyerProductDataApis: ApiReferenceItem[] = [
  {
    name: "Get product description",
    path: "/eco/buyer/product/description",
    purpose: "Recuperer la fiche detail complete: detail_url, images, skus, wholesale_trade, video_url et supplier.",
  },
  {
    name: "Get product key attributes",
    path: "/eco/buyer/product/keyattributes",
    purpose: "Recuperer les attributs cles d'un produit Alibaba par type d'attributs.",
  },
  {
    name: "Get item inventory",
    path: "/eco/buyer/product/inventory",
    purpose: "Verifier le stock par product_id, sku_id et shipping_from.",
  },
  {
    name: "Get product certificates",
    path: "/eco/buyer/product/cert",
    purpose: "Recuperer les certificats d'un produit Alibaba.",
  },
];

export const ecoBuyerWorkflow: IntegrationStep[] = [
  {
    title: "Pousser ou synchroniser le catalogue ISV",
    detail: "Utiliser item/add, item/update, item/query et item/delete pour maintenir un miroir de produits partenaires dans l'ecosysteme Alibaba.",
  },
  {
    title: "Declencher les canaux et imports asynchrones",
    detail: "Envoyer product/events pour les changements de statut/prix et batch-import pour envoyer les produits vers des channel stores.",
  },
  {
    title: "Explorer et recommander",
    detail: "Combiner product/check, product/search, item/rec et item/rec/image pour discovery, matching et sourcing visuel.",
  },
  {
    title: "Hydrater la fiche produit",
    detail: "Utiliser product/description, keyattributes, inventory et cert pour presenter une fiche exploitable avant import ou commande.",
  },
  {
    title: "Distinguer les stocks et corridors",
    detail: "Separer cross-border, local et localregular selon le mode de fulfillment et la disponibilite pays.",
  },
];

export const ecoBuyerPayloadNotes: KeyValueReference[] = [
  { key: "insertReq / updateReq / deleteReq / queryReq", value: "objet metier encode cote requete", detail: "Les endpoints /eco/buyer/* prennent un objet unique en query ou body selon le verbe HTTP." },
  { key: "result_code", value: "00 ou 200", detail: "Les flows eco buyer renvoient souvent un result_code metier en plus du code=0 plateforme." },
  { key: "item_id vs isv_item_id", value: "Alibaba item id et identifiant ISV", detail: "Les retours item/query exposent souvent les deux pour le mapping partenaire <-> Alibaba." },
  { key: "pagination", value: "current, page_count, page_size, total_product_count", detail: "Structure recurrente sur item/query, product/search, item/rec et item/rec/image." },
  { key: "channel import async", value: "site_id + pending_count", detail: "batch-import ne termine pas immediatement l'import; il faut suivre le traitement asynchrone cote canal." },
];

export const ecoBuyerErrors: ErrorReference[] = [
  {
    code: "400",
    title: "Malformed eco buyer request",
    cause: "Le query-string ou l'objet encode ne respecte pas le contrat attendu par l'endpoint, surtout sur product/search.",
    resolution: "Verifier le type, les champs requis et la serialisation de l'objet param0/query_req/recReq/req avant renvoi.",
  },
  {
    code: "500",
    title: "Eco buyer system error",
    cause: "Le serveur n'a pas pu traiter la requete a cause d'une erreur interne.",
    resolution: "Retenter avec backoff puis remonter request_id/trace id au support si l'erreur persiste.",
  },
  {
    code: "10000001",
    title: "Video service system or param error",
    cause: "Les endpoints video peuvent retourner msg_info=system error ou illegal params meme quand code=0.",
    resolution: "Verifier video_id, product_id, pagination et URLs video/couverture, puis repoller upload/result via req_id si besoin.",
  },
  {
    code: "result_code != success",
    title: "Business-level eco failure",
    cause: "L'API plateforme repond code=0 mais le result_code metier n'indique pas un succes reel.",
    resolution: "Toujours controler result_code/result_msg/result_message au lieu de se fier uniquement au code top-level.",
  },
];

export const freightAndOrderExecutionApis: ApiReferenceItem[] = [
  {
    name: "Basic freight estimation",
    path: "/shipping/freight/calculate",
    purpose: "Estimer un cout de transport simple avec destination_country, product_id, quantity et optionnellement zip_code.",
  },
  {
    name: "Advanced freight calculation",
    path: "/order/freight/calculate",
    purpose: "Calculer un freight plus precis avec e_company_id, adresse detaillee, logistics_product_list et dispatch_location.",
    note: "e_company_id vient du detail produit /eco/buyer/product/description.",
  },
  {
    name: "Create BuyNow order",
    path: "/buynow/order/create",
    purpose: "Creer une commande BuyNow avec logistics_detail, product_list, properties, remarks, attachments et clearance_detail.",
  },
  {
    name: "Dropshipping order pay",
    path: "/alibaba/dropshipping/order/pay",
    purpose: "Declencher le paiement dropshipping et recuperer pay_url, status et motifs d'echec metier.",
  },
  {
    name: "Order pay result query",
    path: "/alibaba/order/pay/result/query",
    purpose: "Verifier le resultat du paiement d'une commande a partir de trade_id.",
  },
  {
    name: "Order fund query",
    path: "/alibaba/order/fund/query",
    purpose: "Lire les donnees de frais ou de transaction, par exemple payment_transaction_fee via data_select.",
  },
];

export const logisticsExecutionApis: ApiReferenceItem[] = [
  {
    name: "Order logistics query",
    path: "/order/logistics/query",
    purpose: "Recuperer le logistic_status, les shipping_order_list et les tracking numbers via data_select=logistic_order.",
  },
  {
    name: "Order logistics tracking get",
    path: "/order/logistics/tracking/get",
    purpose: "Suivre les evenements logistiques detailles par transporteur et tracking_url.",
  },
  {
    name: "Order attachment upload",
    path: "/alibaba/order/attachment/upload",
    purpose: "Uploader un document de commande et recuperer un file_path reutilisable dans shipping ou order create.",
    note: "Taille max 5 MB; extensions annoncees: jpg, png, pdf, doc.",
  },
  {
    name: "Single order shipping",
    path: "/alibaba/v2/order/shipping",
    purpose: "Creer un voucher logistique unitaire a partir d'un shipping_request.",
  },
  {
    name: "Multi shipping",
    path: "/alibaba/order/v2/multi/shipping",
    purpose: "Creer plusieurs vouchers logistiques via param_multi_shipping_create_request et requests[].",
  },
  {
    name: "Order cancel",
    path: "/alibaba/order/cancel",
    purpose: "Annuler une commande a partir de trade_id.",
  },
];

export const orderReadAndWarehouseApis: ApiReferenceItem[] = [
  {
    name: "Order get",
    path: "/alibaba/order/get",
    purpose: "Lire le detail complet d'une commande, y compris status_action, attachments, address, seller/buyer, montants et order_products.",
    note: "data_select supporte notamment statusAction, draft_role et snapshot_product.",
  },
  {
    name: "Order list",
    path: "/alibaba/order/list",
    purpose: "Lister les commandes par role, fenetres create/modify date, salesperson et status.",
  },
  {
    name: "Overseas admittance check",
    path: "/icbu/check/overseas/admittance",
    purpose: "Verifier l'admittance du marchand pour les warehouses overseas sur la plateforme Alibaba.",
  },
  {
    name: "Seller warehouse list",
    path: "/warehouse/list",
    purpose: "Lister les warehouses d'un produit, avec filtrage optionnel par country_code.",
  },
  {
    name: "GGS warehouse list",
    path: "/alibaba/ggs/warehouse/list",
    purpose: "Lister les entrepots GGS d'un vendeur avec pagination et metadonnees d'entrepot.",
  },
];

export const orderExecutionWorkflow: IntegrationStep[] = [
  {
    title: "Estimer le freight d'abord",
    detail: "Commencer par shipping/freight/calculate pour une estimation rapide puis order/freight/calculate pour figer un carrier_code et un cout plus precis.",
  },
  {
    title: "Construire logistics_detail correctement",
    detail: "Renseigner shipment_address, dispatch_location et carrier_code; la shipping address devient obligatoire dans certains pays comme la Coree selon la clearance.",
  },
  {
    title: "Creer la commande BuyNow",
    detail: "Envoyer channel_refer_id, product_list, properties de plateforme, remarques et attachments si distribution waybill ou documents douane sont requis.",
  },
  {
    title: "Piloter le paiement",
    detail: "Suivre pay_url, pay result query et dropshipping/order/pay pour comprendre les failures metiers et relancer les actions cote buyer.",
  },
  {
    title: "Executer puis tracer la logistique",
    detail: "Uploader les attachments, creer voucher_id/voucher_ids, lire order/logistics/query puis order/logistics/tracking/get pour l'historique transporteur.",
  },
  {
    title: "Controler warehouses et admittance",
    detail: "Avant fulfillment overseas, verifier /icbu/check/overseas/admittance et les listes d'entrepots standard ou GGS.",
  },
];

export const orderExecutionPayloadNotes: KeyValueReference[] = [
  { key: "e_company_id", value: "supplier/company id encode", detail: "A recuperer depuis le detail produit eco buyer avant advanced freight calculation." },
  { key: "logistics_detail", value: "shipment_address + dispatch_location + carrier_code", detail: "Structure centrale de /buynow/order/create pour figer la route logistique." },
  { key: "properties", value: "platform + orderId tiers", detail: "Permet de relier la commande Alibaba a la commande Shopify, WooCommerce, BigCommerce, etc." },
  { key: "attachments", value: "file_path + file_usage + waybill metadata", detail: "Le file_path vient de /alibaba/order/attachment/upload et peut servir au distribution waybill." },
  { key: "clearance_detail", value: "business or personal clearance info", detail: "Necessaire selon le pays et les exigences douanieres; exemple detaille fourni pour la Coree." },
  { key: "data_select", value: "fund_transaction_fee | logistic_order | statusAction...", detail: "Beaucoup d'endpoints order/logistics lisent des sous-vues optionnelles via data_select." },
];

export const orderExecutionErrors: ErrorReference[] = [
  {
    code: "402",
    title: "Shipping request invalid",
    cause: "Le shipping request multi ou single est incomplet: tradeId, serviceProvider, trackingNumber ou logisticsType manquant/invalide.",
    resolution: "Verifier tous les champs obligatoires et limiter logisticsType a EXPRESS ou POST.",
  },
  {
    code: "403",
    title: "Not your order or admin",
    cause: "Le compte operateur n'est pas proprietaire de la commande ou n'a pas le role admin requis pour shipping.",
    resolution: "Executer l'appel avec le bon compte autorise et l'ordre correspondant.",
  },
  {
    code: "404",
    title: "Order not found",
    cause: "tradeId ne correspond a aucune commande existante.",
    resolution: "Verifier trade_id/e_trade_id avant create shipping, cancel ou tracking.",
  },
  {
    code: "500",
    title: "Warehouse or shipping system error",
    cause: "Erreur technique sur admittance, warehouse ou generation des vouchers logistiques.",
    resolution: "Retenter avec backoff puis journaliser request_id pour support si l'erreur persiste.",
  },
  {
    code: "PAY_FAILED / NEVER_PAY_SUCCESS_IN_DROPSHIPER / 50006",
    title: "Payment not completed",
    cause: "Le buyer n'a jamais paye un ordre dropshipping avec succes ou la transaction a echoue avec reason_code metier.",
    resolution: "Utiliser pay_url retourne par l'API et repoller /alibaba/order/pay/result/query jusqu'a resolution.",
  },
];