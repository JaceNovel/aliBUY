"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Bot, MessageCircleHeart, SendHorizonal, Sparkles, UserRound, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { SITE_LOGO_PATH, SITE_NAME } from "@/lib/site-config";

type SessionPayload = {
  user: {
    displayName?: string;
    firstName?: string;
  } | null;
};

type WidgetMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
};

type ChatResponse = {
  reply?: string;
  escalate?: boolean;
  suggestions?: string[];
  handoffLabel?: string;
};

const STORAGE_KEY = "afripay-chat-history";

const starterSuggestions = [
  "Suivi commande",
  "Importer avec AfriPay",
  "Articles gratuits",
  "Parler a une personne",
];

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildInitialMessage(firstName?: string) {
  if (firstName) {
    return `Bonjour ${firstName}, bienvenue sur AfriPay. Je peux vous aider pour vos commandes, vos imports Alibaba, vos paiements ou l'offre Articles Gratuits.`;
  }

  return "Bonjour, bienvenue sur AfriPay. Je peux vous aider pour vos commandes, vos imports Alibaba, vos paiements ou l'offre Articles Gratuits.";
}

export function SiteChatWidget() {
  const pathname = usePathname();
  const isFreeDealRoute = pathname.startsWith("/articles-gratuits");
  const [isOpen, setIsOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [session, setSession] = useState<SessionPayload["user"]>(null);
  const [draft, setDraft] = useState("");
  const [shouldEscalate, setShouldEscalate] = useState(false);
  const [handoffLabel, setHandoffLabel] = useState("Parler a une personne");
  const [suggestions, setSuggestions] = useState<string[]>(starterSuggestions);
  const [messages, setMessages] = useState<WidgetMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setIsHydrated(true);

    const loadSession = async () => {
      try {
        const response = await fetch("/api/account/session", { cache: "no-store" });
        const data = (await response.json()) as SessionPayload;
        const nextUser = data.user ?? null;
        setSession(nextUser);

        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as WidgetMessage[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMessages(parsed);
            return;
          }
        }

        setMessages([
          {
            id: createId(),
            role: "assistant",
            content: buildInitialMessage(nextUser?.firstName),
          },
        ]);
      } catch {
        setMessages([
          {
            id: createId(),
            role: "assistant",
            content: buildInitialMessage(),
          },
        ]);
      } finally {
        setIsLoadingSession(false);
      }
    };

    void loadSession();
  }, []);

  useEffect(() => {
    if (!isHydrated || messages.length === 0) {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-24)));
  }, [isHydrated, messages]);

  useEffect(() => {
    if (!scrollRef.current) {
      return;
    }

    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isTyping, isOpen]);

  const humanSupportHref = useMemo(() => {
    return session ? "/messages" : "/login?next=/messages";
  }, [session]);

  const sendMessage = async (rawMessage: string) => {
    const content = rawMessage.trim();
    if (!content || isTyping) {
      return;
    }

    const nextUserMessage: WidgetMessage = {
      id: createId(),
      role: "user",
      content,
    };

    const nextHistory = [...messages, nextUserMessage];
    setMessages(nextHistory);
    setDraft("");
    setIsTyping(true);

    try {
      const response = await fetch("/api/chat-assistant", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          message: content,
          history: nextHistory.map((message) => ({
            role: message.role,
            content: message.content,
          })),
        }),
      });

      const data = (await response.json()) as ChatResponse;

      setMessages((current) => [
        ...current,
        {
          id: createId(),
          role: "assistant",
          content: data.reply?.trim() || "Je suis la pour vous aider sur AfriPay.",
        },
      ]);
      setShouldEscalate(Boolean(data.escalate));
      setSuggestions(data.suggestions?.length ? data.suggestions : starterSuggestions);
      setHandoffLabel(data.handoffLabel?.trim() || "Parler a une personne");
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: createId(),
          role: "assistant",
          content: "Le chat ralentit un peu. Vous pouvez reessayer maintenant ou parler a une personne AfriPay.",
        },
      ]);
      setShouldEscalate(true);
      setSuggestions(["Parler a une personne", "Reessayer", "Suivi commande"]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await sendMessage(draft);
  };

  if (!isHydrated) {
    return null;
  }

  return (
    <>
      <section
        className={[
          "fixed inset-x-4 bottom-[calc(var(--mobile-bottom-nav-height)+var(--mobile-floating-cta-height)+18px)] z-[140] overflow-hidden rounded-[22px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,247,241,0.98),rgba(255,255,255,0.98))] shadow-[0_20px_44px_rgba(43,17,0,0.16)] backdrop-blur-xl transition duration-200 ease-out sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[420px] sm:rounded-[28px] sm:shadow-[0_30px_80px_rgba(43,17,0,0.22)]",
          isFreeDealRoute ? "hidden sm:block" : "",
          isOpen ? "pointer-events-auto translate-y-0 scale-100 opacity-100" : "pointer-events-none translate-y-5 scale-[0.96] opacity-0",
        ].join(" ")}
      >
            <div className="relative overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top_left,rgba(250,100,0,0.18),transparent_58%),radial-gradient(circle_at_top_right,rgba(255,184,107,0.22),transparent_38%),linear-gradient(135deg,#fff0e3,#fff8f3)] sm:h-40" />
              <div className="relative border-b border-[#f4ddcd] px-3.5 pb-2.5 pt-3.5 sm:px-6 sm:pb-5 sm:pt-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="relative flex h-10 w-10 items-center justify-center rounded-[14px] bg-white shadow-[0_12px_20px_rgba(250,100,0,0.12)] ring-1 ring-[#ffe0ca] sm:h-14 sm:w-14 sm:rounded-[20px] sm:shadow-[0_18px_34px_rgba(250,100,0,0.18)]">
                      <Image src={SITE_LOGO_PATH} alt={`${SITE_NAME} chat`} width={40} height={40} className="h-7 w-7 object-contain sm:h-9 sm:w-9" />
                      <span className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full bg-[#14b85a] ring-2 ring-white" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#f06a13] sm:text-[11px] sm:tracking-[0.28em]">
                        <Sparkles className="h-3.5 w-3.5" />
                        Chat AfriPay
                      </div>
                      <div className="mt-1 text-[18px] font-bold tracking-[-0.06em] text-[#161616] sm:text-[30px]">
                        Assistance premium
                      </div>
                      <p className="mt-1 max-w-[220px] text-[11px] leading-4 text-[#5a6170] sm:mt-2 sm:max-w-[260px] sm:text-[13px] sm:leading-6">
                        Reponse immediate, style AfriPay.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/88 text-[#222] ring-1 ring-[#f1d4c2] transition hover:-translate-y-0.5 hover:bg-white sm:h-10 sm:w-10"
                    aria-label="Fermer le chat"
                  >
                    <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="px-3 pb-3 pt-2.5 sm:px-5 sm:pb-5 sm:pt-4">
              <div className="mb-3 grid grid-cols-2 gap-2 sm:mb-4 sm:flex sm:flex-wrap">
                {suggestions.slice(0, 4).map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => {
                      void sendMessage(suggestion);
                    }}
                    className="rounded-full border border-[#f3d8c6] bg-white px-2.5 py-1.5 text-[10px] font-semibold text-[#374151] transition hover:-translate-y-0.5 hover:border-[#f6b78f] hover:text-[#d85a00] sm:px-3.5 sm:py-2 sm:text-[12px]"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>

              <div
                ref={scrollRef}
                className="h-[176px] space-y-2 overflow-y-auto rounded-[18px] bg-[linear-gradient(180deg,#fff8f3_0%,#fff_100%)] px-2 py-2 ring-1 ring-[#f6e3d7] sm:h-[360px] sm:space-y-3 sm:rounded-[24px] sm:px-4 sm:py-4"
              >
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={[
                      "flex",
                      message.role === "user" ? "justify-end" : "justify-start",
                    ].join(" ")}
                  >
                    <div
                      className={[
                        "max-w-[88%] rounded-[16px] px-2.5 py-2 text-[11px] leading-5 shadow-[0_8px_18px_rgba(34,34,34,0.05)] sm:max-w-[85%] sm:rounded-[22px] sm:px-4 sm:py-3 sm:text-[14px] sm:leading-6",
                        message.role === "user"
                          ? "bg-[linear-gradient(135deg,#fa6400,#ff8a26)] text-white"
                          : "border border-[#f1e3d8] bg-white text-[#2f3543]",
                      ].join(" ")}
                    >
                      <div className="mb-1 flex items-center gap-1 text-[8px] font-semibold uppercase tracking-[0.12em] opacity-80 sm:gap-2 sm:text-[10px] sm:tracking-[0.16em]">
                        {message.role === "user" ? <UserRound className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> : <Bot className="h-3 w-3 sm:h-3.5 sm:w-3.5" />}
                        {message.role === "user" ? "Vous" : "AfriPay AI"}
                      </div>
                      <div>{message.content}</div>
                    </div>
                  </div>
                ))}

                {isTyping ? (
                  <div className="flex justify-start">
                    <div className="rounded-[16px] border border-[#f1e3d8] bg-white px-2.5 py-2 text-[#7b8392] shadow-[0_8px_18px_rgba(34,34,34,0.05)] sm:rounded-[22px] sm:px-4 sm:py-3">
                      <div className="mb-1 flex items-center gap-1.5 text-[8px] font-semibold uppercase tracking-[0.12em] text-[#5f6672] sm:text-[10px] sm:tracking-[0.16em]">
                        <Bot className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                        AfriPay AI
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 animate-bounce rounded-full bg-[#fa6400] [animation-delay:-0.2s]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-[#ff8c42] [animation-delay:-0.1s]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-[#ffb16e]" />
                      </div>
                    </div>
                  </div>
                ) : null}

                {!isLoadingSession && shouldEscalate ? (
                  <div className="rounded-[16px] border border-[#ffd7c1] bg-[linear-gradient(135deg,#fff5ed,#fff)] px-2.5 py-2.5 shadow-[0_8px_18px_rgba(250,100,0,0.08)] sm:rounded-[22px] sm:px-4 sm:py-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#f06a13] sm:text-[11px] sm:tracking-[0.18em]">
                          <MessageCircleHeart className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          Assistance humaine
                        </div>
                        <p className="mt-1 text-[11px] leading-4 text-[#474d59] sm:mt-2 sm:text-[13px] sm:leading-6">
                          Pour une demande plus poussee, un conseiller AfriPay peut prendre le relais directement.
                        </p>
                      </div>
                      <Link
                        href={humanSupportHref}
                        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[#161616] px-3.5 py-2 text-[11px] font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#fa6400] sm:px-4 sm:py-2.5 sm:text-[12px]"
                      >
                        {handoffLabel}
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                ) : null}
              </div>

              <form onSubmit={handleSubmit} className="mt-2.5 rounded-[18px] border border-[#f3ddd0] bg-white p-2 shadow-[0_12px_22px_rgba(42,18,0,0.06)] sm:mt-4 sm:rounded-[24px] sm:p-3">
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  rows={2}
                  placeholder="Ecrivez votre message ici..."
                  className="min-h-[42px] w-full resize-none bg-transparent text-[12px] text-[#222] outline-none placeholder:text-[#9aa2af] sm:min-h-[84px] sm:text-[14px]"
                />
                <div className="mt-2 flex items-center justify-between gap-2 sm:mt-3">
                  <div className="text-[9px] leading-4 text-[#7b8392] sm:text-[11px] sm:leading-5">
                    IA en premiere ligne, puis conseiller humain si la demande devient plus sensible.
                  </div>
                  <button
                    type="submit"
                    disabled={!draft.trim() || isTyping}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[linear-gradient(135deg,#fa6400,#ff8f2d)] text-white shadow-[0_12px_20px_rgba(250,100,0,0.22)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 sm:h-12 sm:w-12"
                    aria-label="Envoyer"
                  >
                    <SendHorizonal className="h-4 w-4 sm:h-5 sm:w-5" />
                  </button>
                </div>
              </form>
            </div>
      </section>

      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        aria-label={isOpen ? "Fermer le chat AfriPay" : "Ouvrir le chat AfriPay"}
        className={[
          "fixed bottom-[calc(var(--mobile-bottom-nav-height)+var(--mobile-floating-cta-height)+18px)] right-2 z-[135] inline-flex items-center gap-2 rounded-full border border-white/70 bg-[linear-gradient(135deg,rgba(250,100,0,0.98),rgba(255,146,49,0.96))] px-1.5 py-1.5 text-white shadow-[0_16px_30px_rgba(250,100,0,0.28)] transition duration-200 hover:-translate-y-0.5 hover:scale-[1.02] sm:bottom-6 sm:right-6 sm:gap-3 sm:px-4 sm:py-3",
          isFreeDealRoute ? "hidden sm:inline-flex" : "",
        ].join(" ")}
      >
        <span className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-white/94 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.6)] sm:h-12 sm:w-12">
          <Image src={SITE_LOGO_PATH} alt={`${SITE_NAME} logo`} width={34} height={34} className="h-6 w-6 object-contain sm:h-9 sm:w-9" />
          <span className="absolute right-0 top-0 h-3.5 w-3.5 rounded-full bg-[#14b85a] ring-2 ring-[#fa6400]" />
        </span>
        <span className="hidden pr-1 text-left sm:block">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-white/76">AfriPay Live</span>
          <span className="block text-[15px] font-semibold tracking-[-0.03em]">Ouvrir le chat</span>
        </span>
      </button>
    </>
  );
}
