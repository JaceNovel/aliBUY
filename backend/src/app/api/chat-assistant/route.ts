import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type ChatMessage = {
  role?: "user" | "assistant";
  content?: string;
};

const QUICK_REPLIES = {
  shipping:
    "AfriPay vous aide a comprendre la livraison, le transport et les delais. Donnez-moi votre pays de livraison et le contexte (commande ou question generale) et je vous guide.",
  payment:
    "Nous pouvons vous orienter sur les paiements, la validation des commandes et les etapes de securisation avant expedition. Si votre demande concerne un paiement bloque ou un cas sensible, je peux aussi vous envoyer vers un conseiller.",
  account:
    "Je peux vous aider pour votre compte, vos favoris, votre panier et vos commandes. Si c'est un probleme de connexion ou d'acces admin, je peux vous orienter vers l'espace adapte.",
  order:
    "Pour une commande, je peux vous aider a comprendre le statut, la preparation, l'expedition ou les prochaines etapes. Si le dossier est sensible, je peux vous proposer de parler a une personne.",
};

function normalizeMessage(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function isGreeting(message: string) {
  return ["bonjour", "bonsoir", "salut", "hello", "coucou", "cc"].some((keyword) => message.includes(keyword));
}

function detectIntent(message: string) {
  if (/(livraison|expedition|transport|bateau|douane|delai|shipping)/.test(message)) {
    return "shipping";
  }

  if (/(payer|paiement|payment|carte|virement|facture|invoice)/.test(message)) {
    return "payment";
  }

  if (/(compte|profil|connexion|login|favori|panier|mot de passe|password)/.test(message)) {
    return "account";
  }

  if (/(commande|order|suivi|statut|reception|recu)/.test(message)) {
    return "order";
  }

  return "general";
}

function shouldEscalate(message: string) {
  return /(humain|agent|personne|conseiller|litige|urgent|arnaque|escroquerie|remboursement|plainte|bloque|bug complexe|probleme complexe)/.test(message);
}

function buildSuggestions(intent: string, escalate: boolean) {
  if (escalate) {
    return ["Parler a une personne", "Suivi commande", "Paiement"];
  }

  if (intent === "shipping") {
    return ["Delai de livraison", "Douane et transport", "Parler a une personne"];
  }

  if (intent === "payment") {
    return ["Modes de paiement", "Commande securisee", "Parler a une personne"];
  }

  return ["Suivi commande", "Paiement", "Parler a une personne"];
}

function buildReply(message: string) {
  const normalized = normalizeMessage(message);
  const escalate = shouldEscalate(normalized);
  const intent = detectIntent(normalized);

  if (isGreeting(normalized)) {
    return {
      reply:
        "Bonjour, je suis l'assistant AfriPay. Je peux vous aider pour une commande, un paiement, la livraison ou votre compte. Dites-moi simplement ce dont vous avez besoin.",
      escalate,
      suggestions: buildSuggestions(intent, escalate),
    };
  }

  if (escalate) {
    return {
      reply:
        "Je peux deja vous accompagner, mais votre demande semble necessiter une verification plus poussee. Je vous recommande de parler a une personne AfriPay pour un suivi direct.",
      escalate: true,
      suggestions: buildSuggestions(intent, true),
    };
  }

  if (intent !== "general") {
    return {
      reply: QUICK_REPLIES[intent],
      escalate: false,
      suggestions: buildSuggestions(intent, false),
    };
  }

  return {
    reply:
      "Je peux vous aider sur AfriPay pour comprendre une commande, verifier un paiement, suivre une livraison ou gerer votre compte. Donnez-moi un peu plus de contexte et je vous reponds tout de suite.",
    escalate: false,
    suggestions: buildSuggestions(intent, false),
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { message?: string; history?: ChatMessage[] };
    const message = body.message?.trim();

    if (!message) {
      return NextResponse.json({ error: "Message manquant." }, { status: 400 });
    }

    const response = buildReply(message);

    return NextResponse.json({
      ...response,
      handoffLabel: "Parler a une personne",
      historySize: Array.isArray(body.history) ? body.history.length : 0,
    });
  } catch {
    return NextResponse.json(
      {
        reply:
          "Le service chat rencontre un petit ralentissement. Vous pouvez reessayer maintenant ou demander a parler a une personne AfriPay.",
        escalate: true,
        suggestions: ["Parler a une personne", "Reessayer", "Suivi commande"],
        handoffLabel: "Parler a une personne",
      },
      { status: 200 },
    );
  }
}
