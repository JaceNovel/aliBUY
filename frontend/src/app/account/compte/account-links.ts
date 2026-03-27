import { LockKeyhole, Settings2, Smartphone, UserCircle2 } from "lucide-react";

export const accountCards = [
  {
    title: "Informations du compte",
    icon: UserCircle2,
    items: [
      { label: "Mon profil", slug: "mon-profil" },
      { label: "Profil de membre", slug: "profil-de-membre" },
      { label: "Comptes connectés", slug: "comptes-connectes" },
      { label: "Informations fiscales", slug: "informations-fiscales" },
    ],
  },
  {
    title: "Sécurité",
    icon: LockKeyhole,
    items: [
      { label: "Modifier le mot de passe", slug: "modifier-mot-de-passe" },
      { label: "Vérification en deux étapes", slug: "verification-deux-etapes" },
      { label: "Sessions actives", slug: "sessions-actives" },
      { label: "Supprimer le compte", slug: "supprimer-compte" },
    ],
  },
  {
    title: "Coordonnées",
    icon: Smartphone,
    items: [
      { label: "Changer l'adresse e-mail", slug: "changer-adresse-email" },
      { label: "Changer le numéro de téléphone", slug: "changer-numero-telephone" },
      { label: "Préférences SMS", slug: "preferences-sms" },
    ],
  },
  {
    title: "Préférences",
    icon: Settings2,
    items: [
      { label: "Confidentialité", slug: "confidentialite" },
      { label: "Préférences d'e-mails", slug: "preferences-emails" },
      { label: "Préférences publicitaires", slug: "preferences-publicitaires" },
    ],
  },
] as const;

export const accountPageMeta = {
  "mon-profil": {
    title: "Mon profil",
    description: "Consultez et mettez à jour vos informations personnelles liées à votre profil AfriPay.",
    bullets: ["Nom affiché du compte", "Photo de profil", "Informations visibles sur vos échanges"],
    accent: "#ff6a00",
  },
  "profil-de-membre": {
    title: "Profil de membre",
    description: "Gérez votre statut membre, vos badges et les informations de confiance visibles côté fournisseur.",
    bullets: ["Statut de membre", "Badge du compte", "Résumé de votre activité"],
    accent: "#ff6a00",
  },
  "comptes-connectes": {
    title: "Comptes connectés",
    description: "Retrouvez les services liés à votre compte AfriPay et sécurisez les connexions externes.",
    bullets: ["Google", "Apple", "Services partenaires autorisés"],
    accent: "#2b67f6",
  },
  "informations-fiscales": {
    title: "Informations fiscales",
    description: "Renseignez vos données fiscales et d’identification pour vos achats professionnels.",
    bullets: ["Numéro fiscal", "Raison sociale", "Adresse de facturation"],
    accent: "#127a46",
  },
  "modifier-mot-de-passe": {
    title: "Modifier le mot de passe",
    description: "Mettez à jour votre mot de passe pour renforcer la sécurité du compte.",
    bullets: ["Ancien mot de passe", "Nouveau mot de passe", "Confirmation du mot de passe"],
    accent: "#111111",
  },
  "verification-deux-etapes": {
    title: "Vérification en deux étapes",
    description: "Ajoutez une couche de sécurité supplémentaire pour chaque connexion sensible.",
    bullets: ["Application d’authentification", "SMS de secours", "Code de récupération"],
    accent: "#127a46",
  },
  "sessions-actives": {
    title: "Sessions actives",
    description: "Consultez les appareils connectés à votre compte et déconnectez les sessions suspectes.",
    bullets: ["Téléphone actuel", "Navigateur récent", "Déconnexion à distance"],
    accent: "#2b67f6",
  },
  "supprimer-compte": {
    title: "Supprimer le compte",
    description: "Demandez la suppression définitive de votre compte AfriPay après vérification de sécurité.",
    bullets: ["Confirmation d’identité", "Suppression des données", "Effet irréversible"],
    accent: "#c74444",
  },
  "changer-adresse-email": {
    title: "Changer l'adresse e-mail",
    description: "Mettez à jour votre e-mail principal pour les notifications et validations de commande.",
    bullets: ["Adresse actuelle", "Nouvelle adresse", "Validation par code"],
    accent: "#ff6a00",
  },
  "changer-numero-telephone": {
    title: "Changer le numéro de téléphone",
    description: "Associez un nouveau numéro pour sécuriser vos connexions et paiements.",
    bullets: ["Numéro actuel", "Nouveau numéro", "Code OTP"],
    accent: "#ff6a00",
  },
  "preferences-sms": {
    title: "Préférences SMS",
    description: "Choisissez quels messages de sécurité et de commande vous souhaitez recevoir par SMS.",
    bullets: ["Alertes sécurité", "Mises à jour de commande", "Rappels logistiques"],
    accent: "#2b67f6",
  },
  confidentialite: {
    title: "Confidentialité",
    description: "Définissez vos réglages de visibilité, d’historique et de protection des données.",
    bullets: ["Visibilité du profil", "Historique d’activité", "Consentement des données"],
    accent: "#127a46",
  },
  "preferences-emails": {
    title: "Préférences d'e-mails",
    description: "Activez ou réduisez les e-mails de suivi, d’offres et d’information AfriPay.",
    bullets: ["Suivi des commandes", "Alertes marketing", "Résumé hebdomadaire"],
    accent: "#2b67f6",
  },
  "preferences-publicitaires": {
    title: "Préférences publicitaires",
    description: "Ajustez vos recommandations publicitaires et le niveau de personnalisation des annonces.",
    bullets: ["Annonces personnalisées", "Centres d’intérêt", "Fréquence des campagnes"],
    accent: "#ff6a00",
  },
} as const;

export type AccountPageSlug = keyof typeof accountPageMeta;