import type { LogisticsAgentId } from "@/lib/orders-data";

export type MessageStatus = "en ligne" | "en transit" | "dossier clos";
export type MessageTab = "service" | "agents";

export type MessageBubble = {
  side: "left" | "right";
  text: string;
};

export type MessageEntry = {
  id: string;
  tab: MessageTab;
  name: string;
  email?: string;
  role: string;
  preview: string;
  time: string;
  status: MessageStatus;
  aiEnabled?: boolean;
  messages: MessageBubble[];
};

export const messageTabs: Array<{ id: MessageTab; label: string }> = [
  { id: "service", label: "Service AfriPay" },
  { id: "agents", label: "Agents logistique" },
];

export const messageEntries: MessageEntry[] = [
  {
    id: "support-franck",
    tab: "service",
    name: "Franck",
    email: "atyfadj888@gmail.com",
    role: "Client marketplace",
    preview: "Bonjour j'aimerais commander des gants gaming.",
    time: "10:52",
    status: "en ligne",
    aiEnabled: true,
    messages: [
      {
        side: "left",
        text: "Bonjour j'aimerais commander des gants gaming",
      },
      {
        side: "right",
        text: "Je suis là pour vous fournir des informations sur nos produits, nos services et notre processus d'importation. Je peux également vous guider à travers notre plateforme en ligne de confiance, AfriPay. Souhaitez-vous connaître plus sur nos produits, nos tarifs, ou notre processus d'importation ?",
      },
    ],
  },
  {
    id: "support-maurel",
    tab: "service",
    name: "Maurel AKPADJA",
    email: "maurel@example.com",
    role: "Prospect B2B",
    preview: "Souhaitez-vous savoir plus sur nos produits ?",
    time: "10:24",
    status: "en ligne",
    aiEnabled: true,
    messages: [
      {
        side: "left",
        text: "Je veux connaître vos conditions pour commander des accessoires téléphoniques en gros.",
      },
      {
        side: "right",
        text: "AfriPay peut vous accompagner sur le catalogue, les MOQ, les devis fournisseurs et le suivi logistique. Dites-moi le type d'accessoires et votre volume cible.",
      },
    ],
  },
  {
    id: "support-atyfadi",
    tab: "service",
    name: "ATYFadi",
    email: "atyfadi@example.com",
    role: "Client retail",
    preview: "Je peux vous aider à choisir parmi nos nouveautés.",
    time: "09:48",
    status: "en ligne",
    aiEnabled: true,
    messages: [
      {
        side: "left",
        text: "Avez-vous des nouveautés gaming avec livraison rapide ?",
      },
      {
        side: "right",
        text: "Oui. Nous avons plusieurs références gaming en stock et des bundles intéressants. Je peux vous orienter vers les produits les plus adaptés à votre budget.",
      },
    ],
  },
  {
    id: "support-lumen",
    tab: "service",
    name: "Lumen",
    email: "lumen@example.com",
    role: "Acheteur pro",
    preview: "Si vous avez des questions sur nos prix, je peux aider.",
    time: "Hier",
    status: "en ligne",
    aiEnabled: true,
    messages: [
      {
        side: "left",
        text: "Je veux comparer vos prix avec un devis précédent reçu chez un autre fournisseur.",
      },
      {
        side: "right",
        text: "Partagez la référence produit, la quantité visée et le corridor logistique souhaité. AfriPay vous aidera à cadrer le devis le plus cohérent.",
      },
    ],
  },
  {
    id: "support-adnane",
    tab: "service",
    name: "Adnane",
    email: "adnane@example.com",
    role: "Demande import",
    preview: "Vous pouvez me contacter via email à tout moment.",
    time: "Hier",
    status: "en transit",
    aiEnabled: true,
    messages: [
      {
        side: "left",
        text: "Je souhaite comprendre votre service d'importation avant de passer commande.",
      },
      {
        side: "right",
        text: "AfriPay coordonne la commande, le suivi fournisseur et les agents logistiques. Nous pouvons aussi vous aider à structurer une demande d'assistance importation.",
      },
    ],
  },
  {
    id: "support-fabrice",
    tab: "service",
    name: "fabrice",
    email: "fabrice@example.com",
    role: "Support paiement",
    preview: "Bonjour ! Non, vous n'aurez pas à payer deux fois.",
    time: "Hier",
    status: "dossier clos",
    aiEnabled: false,
    messages: [
      {
        side: "left",
        text: "J'ai peur d'avoir été débité deux fois après un virement.",
      },
      {
        side: "right",
        text: "Bonjour. Non, vous n'aurez pas à payer deux fois. Notre équipe vérifie toujours la preuve de paiement avant validation définitive du dossier.",
      },
    ],
  },
  {
    id: "service-afripay",
    tab: "agents",
    name: "Service AfriPay",
    role: "Support central",
    preview: "Nous suivons votre dossier et coordonnons les agents logistique.",
    time: "10:05",
    status: "en ligne",
    messages: [
      {
        side: "left",
        text: "Bonjour, je souhaite confirmer quel agent suit actuellement mon expedition et si le dossier est complet.",
      },
      {
        side: "right",
        text: "Bonjour, le service AfriPay suit votre dossier. Zach Cargo gere le depart, Estrelia suit le dedouanement et NIF cargo finalise la remise.",
      },
      {
        side: "left",
        text: "Parfait. Merci de garder le dossier actif jusqu'a confirmation de livraison.",
      },
    ],
  },
  {
    id: "zach-cargo",
    tab: "agents",
    name: "Zach Cargo",
    role: "Agent logistique export",
    preview: "Votre groupage Abidjan part demain a 09:00.",
    time: "09:42",
    status: "en transit",
    messages: [
      {
        side: "left",
        text: "Bonjour, pouvez-vous confirmer la date de depart du conteneur et la mise a jour du suivi portuaire ?",
      },
      {
        side: "right",
        text: "Bonjour, ici Zach Cargo. Le groupage quitte l'entrepot demain matin et l'arrivee estimee reste dans votre fenetre logistique.",
      },
      {
        side: "left",
        text: "Merci. Envoyez aussi la reference du dossier pour que le service AfriPay puisse suivre la livraison.",
      },
    ],
  },
  {
    id: "estrelia",
    tab: "agents",
    name: "Estrelia",
    role: "Agent dedouanement",
    preview: "Le dedouanement de votre lot est en cours.",
    time: "08:15",
    status: "en ligne",
    messages: [
      {
        side: "left",
        text: "Bonjour Estrelia, avez-vous besoin d'un document supplementaire pour debloquer le dossier douane ?",
      },
      {
        side: "right",
        text: "Nous avons recu l'essentiel. Je reste en ligne pour la validation finale et je vous envoie l'accuse des que la mainlevee est confirmee.",
      },
    ],
  },
  {
    id: "nif-cargo",
    tab: "agents",
    name: "NIF cargo",
    role: "Agent livraison finale",
    preview: "Nous avons recu votre bordereau de livraison.",
    time: "Hier",
    status: "dossier clos",
    messages: [
      {
        side: "left",
        text: "Bonjour NIF cargo, la remise finale est-elle terminee et le dossier peut-il etre archive ?",
      },
      {
        side: "right",
        text: "Oui, la livraison a ete remise au destinataire. Le dossier est clos et le bordereau signe est disponible dans vos pieces jointes.",
      },
    ],
  },
];

export function getMessageEntriesByTab(tab: MessageTab) {
  return messageEntries.filter((entry) => entry.tab === tab);
}

export function isLogisticsConversationId(value: string): value is LogisticsAgentId {
  return value === "zach-cargo" || value === "estrelia" || value === "nif-cargo";
}