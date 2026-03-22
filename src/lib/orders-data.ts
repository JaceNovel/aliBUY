export type OrderTab =
  | "Toutes les commandes"
  | "Paiements en attente (2)"
  | "Expeditions en attente"
  | "Livraisons en attente"
  | "Commande Livré";

export type OrderStatus =
  | "Paiement en attente"
  | "Expedition en attente"
  | "Livraison en attente"
  | "Commande Livré";

export type LogisticsAgentId = "zach-cargo" | "estrelia" | "nif-cargo";

export type CountryCode = "CN" | "FR" | "TG" | "CI" | "GH";

type LogisticsAgent = {
  id: LogisticsAgentId;
  name: string;
  coverage: string;
};

export type LogisticsAssignment = {
  agentId: LogisticsAgentId;
  agentName: string;
  corridorLabel: string;
  destinationCountry: string;
  transitMode: string;
  merchantPickupCompleted: boolean;
  trackingCode: string | null;
  lastUpdate: string;
};

export type OrderRecord = {
  id: string;
  dateLabel: string;
  dateValue: string;
  timeValue: string;
  total: string;
  seller: string;
  title: string;
  variant: string;
  image: string;
  status: OrderStatus;
  tab: OrderTab;
  logistics: LogisticsAssignment;
};

type RawOrderRecord = Omit<OrderRecord, "logistics"> & {
  sellerCountryCode: CountryCode;
  destinationCountryCode: CountryCode;
  merchantPickupCompleted?: boolean;
};

export const sidebarItems = [
  "Toutes les commandes",
  "Remboursements et apres-vente",
  "Avis",
  "Coupons et credits",
  "Informations fiscales",
];

export const orderTabs: OrderTab[] = [
  "Toutes les commandes",
  "Paiements en attente (2)",
  "Expeditions en attente",
  "Livraisons en attente",
  "Commande Livré",
];

const countryLabels: Record<CountryCode, string> = {
  CN: "Chine",
  FR: "France",
  TG: "Togo",
  CI: "Cote d'Ivoire",
  GH: "Ghana",
};

const logisticsAgents: Record<LogisticsAgentId, LogisticsAgent> = {
  "zach-cargo": {
    id: "zach-cargo",
    name: "Zach Cargo",
    coverage: "Chine -> Togo et redistribution regionale",
  },
  estrelia: {
    id: "estrelia",
    name: "Estrelia",
    coverage: "France -> Togo",
  },
  "nif-cargo": {
    id: "nif-cargo",
    name: "NIF cargo",
    coverage: "Distribution finale et dossiers livres",
  },
};

function resolveAgentId(sellerCountryCode: CountryCode, destinationCountryCode: CountryCode, status: OrderStatus): LogisticsAgentId {
  if (status === "Commande Livré" && destinationCountryCode === "TG") {
    return "nif-cargo";
  }

  if (sellerCountryCode === "FR" && destinationCountryCode === "TG") {
    return "estrelia";
  }

  if (sellerCountryCode === "CN" && ["TG", "CI", "GH"].includes(destinationCountryCode)) {
    return "zach-cargo";
  }

  return "zach-cargo";
}

function buildTransitMode(sellerCountryCode: CountryCode, destinationCountryCode: CountryCode, agentId: LogisticsAgentId, status: OrderStatus) {
  if (agentId === "estrelia") {
    return "Dedouanement France -> Togo puis distribution finale";
  }

  if (agentId === "nif-cargo") {
    return "Distribution locale finale et confirmation de remise";
  }

  if (sellerCountryCode === "CN" && ["CI", "GH"].includes(destinationCountryCode)) {
    return "Transit Chine -> Togo puis transport routier regional";
  }

  if (status === "Paiement en attente") {
    return "Prise en charge logistique en attente de validation du paiement";
  }

  return `${countryLabels[sellerCountryCode]} -> ${countryLabels[destinationCountryCode]} avec remise locale`;
}

function buildTrackingCode(orderId: string, agentId: LogisticsAgentId, sellerCountryCode: CountryCode, destinationCountryCode: CountryCode, merchantPickupCompleted: boolean) {
  if (!merchantPickupCompleted) {
    return null;
  }

  const prefix = agentId === "zach-cargo" ? "ZC" : agentId === "estrelia" ? "EST" : "NIF";
  const orderDigits = orderId.replace(/[^0-9]/g, "").slice(0, 9);

  return `${prefix}-${sellerCountryCode}-${destinationCountryCode}-${orderDigits}`;
}

function buildLastUpdate(order: RawOrderRecord, assignment: Omit<LogisticsAssignment, "lastUpdate">) {
  if (!assignment.merchantPickupCompleted) {
    return `${assignment.agentName} est deja affecte au dossier. Le tracking sera emis des recuperation du colis chez le marchand.`;
  }

  if (order.destinationCountryCode === "CI" || order.destinationCountryCode === "GH") {
    return `${assignment.agentName} a recupere le colis chez le marchand et prepare le transfert vers le Togo avant l'acheminement routier final vers ${countryLabels[order.destinationCountryCode]}.`;
  }

  if (assignment.agentId === "estrelia") {
    return `${assignment.agentName} a recupere le colis et suit le dedouanement avant la remise au Togo.`;
  }

  if (assignment.agentId === "nif-cargo") {
    return `${assignment.agentName} a archive la preuve de livraison et cloture le dossier.`;
  }

  return `${assignment.agentName} a deja recupere le colis chez le marchand. Le tracking est disponible pour le suivi direct du dossier.`;
}

function buildLogisticsAssignment(order: RawOrderRecord): LogisticsAssignment {
  const merchantPickupCompleted = order.merchantPickupCompleted ?? order.status !== "Paiement en attente";
  const agentId = resolveAgentId(order.sellerCountryCode, order.destinationCountryCode, order.status);
  const agent = logisticsAgents[agentId];
  const baseAssignment = {
    agentId,
    agentName: agent.name,
    corridorLabel: `${countryLabels[order.sellerCountryCode]} -> ${countryLabels[order.destinationCountryCode]}`,
    destinationCountry: countryLabels[order.destinationCountryCode],
    transitMode: buildTransitMode(order.sellerCountryCode, order.destinationCountryCode, agentId, order.status),
    merchantPickupCompleted,
    trackingCode: buildTrackingCode(order.id, agentId, order.sellerCountryCode, order.destinationCountryCode, merchantPickupCompleted),
  };

  return {
    ...baseAssignment,
    lastUpdate: buildLastUpdate(order, baseAssignment),
  };
}

const rawOrders: RawOrderRecord[] = [
  {
    id: "#239826786001021591",
    dateLabel: "03 fevr. 2025, PST",
    dateValue: "2025-02-03",
    timeValue: "PST",
    total: "USD 76.00",
    seller: "Guangzhou Houkang Electronic Technology Co., Ltd.",
    sellerCountryCode: "CN",
    destinationCountryCode: "TG",
    title: "HSDF-Reno4 Pro 12GB+512GB phone mobile 5G android10 MEMORY 5.8 inch HD Screen Dual SIM Deca Core mobile phone",
    variant: "Black, 12g, 512GB, UK x 2 articles",
    image: "https://s.alicdn.com/@sc04/kf/Hceaca7de363f49c5b1ff43ce10a17bc9P.jpg_350x350.jpg",
    status: "Paiement en attente",
    tab: "Paiements en attente (2)",
  },
  {
    id: "#239779138001021591",
    dateLabel: "03 fevr. 2025, PST",
    dateValue: "2025-02-03",
    timeValue: "PST",
    total: "USD 76.00",
    seller: "Guangzhou Houkang Electronic Technology Co., Ltd.",
    sellerCountryCode: "CN",
    destinationCountryCode: "CI",
    title: "HSDF-Reno4 Pro 12GB+512GB phone mobile 5G android10 MEMORY 5.8 inch HD Screen Dual SIM Deca Core mobile phone",
    variant: "Black, 12g, 512GB, UK x 2 articles",
    image: "https://s.alicdn.com/@sc04/kf/Hceaca7de363f49c5b1ff43ce10a17bc9P.jpg_350x350.jpg",
    status: "Paiement en attente",
    tab: "Paiements en attente (2)",
  },
  {
    id: "#240118214008889912",
    dateLabel: "12 mars 2025, GMT",
    dateValue: "2025-03-12",
    timeValue: "GMT",
    total: "USD 124.00",
    seller: "Shenzhen Motion VR Co., Ltd.",
    sellerCountryCode: "CN",
    destinationCountryCode: "GH",
    title: "Casque VR grand angle pour salle de jeux et experience immersive metaverse",
    variant: "Noir mat, bundle pro x 4 articles",
    image: "https://s.alicdn.com/@sc04/kf/Hade212866dcd410fa307eb672830a249i.jpg_350x350.jpg",
    status: "Expedition en attente",
    tab: "Expeditions en attente",
  },
  {
    id: "#240551902001448710",
    dateLabel: "18 mars 2025, UTC+1",
    dateValue: "2025-03-18",
    timeValue: "UTC+1",
    total: "USD 342.00",
    seller: "Paris Office Distribution SAS",
    sellerCountryCode: "FR",
    destinationCountryCode: "TG",
    title: "Bureau gaming LED fibre carbone avec support casque et gestion de cables",
    variant: "Surface noir, 120 cm x 6 articles",
    image: "https://s.alicdn.com/@sc04/kf/H5d39629cd6374a32bea7368985f32f7aR.jpg_350x350.jpg",
    status: "Livraison en attente",
    tab: "Livraisons en attente",
  },
  {
    id: "#240881517009924112",
    dateLabel: "22 mars 2025, UTC",
    dateValue: "2025-03-22",
    timeValue: "UTC",
    total: "USD 418.00",
    seller: "AfriPay Verified Supply Hub",
    sellerCountryCode: "TG",
    destinationCountryCode: "TG",
    title: "Chaise gaming ergonomique RGB avec accoudoirs reglables et coussin lombaire",
    variant: "Rouge noir, lot de 8 pieces",
    image: "https://s.alicdn.com/@sc04/kf/He21b090337c74bbaa1212b233936914aa.jpg_350x350.jpg",
    status: "Commande Livré",
    tab: "Commande Livré",
  },
];

export const orders: OrderRecord[] = rawOrders.map((order) => ({
  ...order,
  logistics: buildLogisticsAssignment(order),
}));

export const pendingProofDefaultOrder = orders.find((order) => order.status === "Paiement en attente") ?? orders[0];

export function getOrderChatHref(order: OrderRecord) {
  return `/messages?tab=agents&conversationId=${encodeURIComponent(order.logistics.agentId)}&orderId=${encodeURIComponent(order.id)}`;
}

export function getOrderTrackingNumber(order: OrderRecord) {
  return order.logistics.trackingCode ?? `AFP-${order.id.replace(/[^0-9]/g, "").slice(0, 10)}`;
}

export function getOrderTrackingHref(order: OrderRecord) {
  return `/orders/tracking?orderId=${encodeURIComponent(order.id)}&tracking=${encodeURIComponent(getOrderTrackingNumber(order))}`;
}

export function getOrderById(orderId?: string | null) {
  if (!orderId) {
    return null;
  }

  return orders.find((order) => order.id === orderId) ?? null;
}

export function getOrderByTracking(tracking?: string | null) {
  if (!tracking) {
    return null;
  }

  return orders.find((order) => getOrderTrackingNumber(order) === tracking) ?? null;
}