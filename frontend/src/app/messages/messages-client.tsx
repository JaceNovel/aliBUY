"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCheck, ChevronLeft, ImagePlus, MessageSquareText, Paperclip, Search, SendHorizonal, SmilePlus, Star } from "lucide-react";

import { SITE_LOGO_PATH, SITE_NAME } from "@/lib/site-config";

type MessageBubble = {
  id?: string;
  side: "left" | "right";
  text: string;
  createdAt?: string;
};

type MessageStatus = "en ligne" | "en transit" | "dossier clos";

type MessageEntry = {
  id: string;
  name: string;
  email?: string;
  role: string;
  preview: string;
  time: string;
  status: MessageStatus;
  updatedAt?: string;
  messages: MessageBubble[];
};

function getStatusStyles(status: MessageStatus) {
  if (status === "en ligne") {
    return "bg-[#e9fff0] text-[#16803c]";
  }

  if (status === "en transit") {
    return "bg-[#fff3e8] text-[#d85a00]";
  }

  return "bg-[#f0f1f4] text-[#555b66]";
}

type MessagesClientProps = {
  conversations: MessageEntry[];
  initialConversationId: string | null;
};

export function MessagesClient({ conversations, initialConversationId }: MessagesClientProps) {
  const fallbackConversationId = initialConversationId && conversations.some((entry) => entry.id === initialConversationId) ? initialConversationId : null;
  const defaultConversationId = fallbackConversationId ?? conversations[0]?.id ?? null;

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedConversationId, setSelectedConversationId] = useState(defaultConversationId);
  const [mobileView, setMobileView] = useState<"list" | "chat">(initialConversationId ? "chat" : "list");
  const [draftMessage, setDraftMessage] = useState("");
  const [liveConversations, setLiveConversations] = useState<MessageEntry[]>(conversations);
  const [isSyncing, setIsSyncing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setLiveConversations(conversations);
  }, [conversations]);

  const filteredEntries = useMemo(() => {
    const normalizedQuery = searchTerm.trim().toLowerCase();

    return liveConversations.filter((entry) => {
      if (!normalizedQuery) {
        return true;
      }

      return `${entry.name} ${entry.role} ${entry.preview}`.toLowerCase().includes(normalizedQuery);
    });
  }, [liveConversations, searchTerm]);

  const selectedConversation =
    filteredEntries.find((entry) => entry.id === selectedConversationId) ?? filteredEntries[0] ?? liveConversations[0];

  useEffect(() => {
    if (!messagesEndRef.current) {
      return;
    }

    messagesEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [selectedConversationId, selectedConversation?.messages]);

  useEffect(() => {
    let cancelled = false;

    const syncMessages = async (showLoader = false) => {
      if (showLoader) {
        setIsSyncing(true);
      }

      try {
        const response = await fetch("/api/messages", { cache: "no-store" });
        const payload = await response.json().catch(() => null) as { conversations?: MessageEntry[] } | null;
        const conversations = payload?.conversations;
        if (!response.ok || !conversations || cancelled) {
          return;
        }

        setLiveConversations(conversations);
        setSelectedConversationId((current) => {
          if (current && conversations.some((entry) => entry.id === current)) {
            return current;
          }

          return conversations[0]?.id ?? null;
        });
      } finally {
        if (!cancelled) {
          setIsSyncing(false);
        }
      }
    };

    void syncMessages(true);
    const interval = window.setInterval(() => {
      void syncMessages(false);
    }, 4000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  if (!selectedConversation) {
    return (
      <section className="rounded-[24px] bg-white px-6 py-8 shadow-[0_8px_30px_rgba(24,39,75,0.05)] ring-1 ring-black/5">
        <h1 className="text-[24px] font-bold text-[#222]">Messages</h1>
        <p className="mt-3 text-[15px] text-[#666]">Aucune conversation n&apos;est encore disponible pour ce compte.</p>
      </section>
    );
  }

  const selectedMessages = selectedConversation.messages;
  const isClosedConversation = selectedConversation.status === "dossier clos";

  const handleSend = async () => {
    const nextMessage = draftMessage.trim();

    if (!nextMessage || isClosedConversation) {
      return;
    }

    const optimisticConversation: MessageEntry = {
      ...selectedConversation,
      preview: nextMessage,
      time: "Envoi...",
      messages: [
        ...selectedMessages,
        { id: `temp-${Date.now()}`, side: "right", text: nextMessage, createdAt: new Date().toISOString() },
      ],
    };

    setLiveConversations((current) => current.map((entry) => (
      entry.id === selectedConversation.id ? optimisticConversation : entry
    )));
    setDraftMessage("");

    const response = await fetch("/api/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ conversationId: selectedConversation.id, text: nextMessage }),
    });

    if (!response.ok) {
      setLiveConversations((current) => current.map((entry) => (
        entry.id === selectedConversation.id ? { ...entry, messages: selectedMessages } : entry
      )));
      setDraftMessage(nextMessage);
      return;
    }

    const payload = await response.json().catch(() => null) as { conversation?: MessageEntry } | null;
    const conversation = payload?.conversation;
    if (conversation) {
      setLiveConversations((current) => {
        const remaining = current.filter((entry) => entry.id !== conversation.id);
        return [conversation, ...remaining];
      });
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2 xl:hidden">
        <button
          type="button"
          onClick={() => setMobileView("list")}
          className={[
            "inline-flex items-center gap-2 rounded-full px-3 py-2 text-[12px] font-semibold transition",
            mobileView === "list" ? "bg-[#222] text-white" : "bg-white text-[#222] ring-1 ring-black/5",
          ].join(" ")}
        >
              <MessageSquareText className="h-4 w-4" />
          Conversations
        </button>
        <button
          type="button"
          onClick={() => setMobileView("chat")}
          className={[
            "inline-flex items-center gap-2 rounded-full px-3 py-2 text-[12px] font-semibold transition",
            mobileView === "chat" ? "bg-[#ff6a00] text-white" : "bg-white text-[#222] ring-1 ring-black/5",
          ].join(" ")}
        >
          Chat actif
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)] xl:gap-6">
      <aside className={[
        "rounded-[22px] bg-white px-4 py-4 shadow-[0_8px_30px_rgba(24,39,75,0.05)] ring-1 ring-black/5 sm:rounded-[28px] sm:px-6 sm:py-6",
        mobileView === "list" ? "block" : "hidden xl:block",
      ].join(" ")}>
        <div className="flex items-center justify-between">
          <h1 className="text-[20px] font-bold tracking-[-0.05em] text-[#222] sm:text-[30px]">Messages</h1>
          <Star className="h-4 w-4 text-[#ff6a00] sm:h-5 sm:w-5" />
        </div>
        <p className="mt-2 text-[13px] leading-5 text-[#666] sm:mt-3 sm:text-[15px] sm:leading-7">Conversations reelles associees a votre compte utilisateur.</p>

        <label className="mt-4 flex h-10 items-center gap-2.5 rounded-[14px] bg-[#f6f6f6] px-3.5 text-[#888] sm:mt-5 sm:h-12 sm:gap-3 sm:px-4">
          <Search className="h-4 w-4" />
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-[#999] sm:text-[15px]"
            placeholder="Rechercher une conversation"
          />
        </label>

        <div className="mt-4 space-y-2.5 sm:mt-5 sm:space-y-3">
          {filteredEntries.map((conversation) => (
            <button
              key={conversation.id}
              type="button"
              onClick={() => {
                setSelectedConversationId(conversation.id);
                setDraftMessage("");
                setMobileView("chat");
              }}
              className={[
                "block w-full rounded-[16px] px-3.5 py-3.5 text-left ring-1 ring-black/5 transition sm:rounded-[18px] sm:px-4 sm:py-4",
                selectedConversation.id === conversation.id ? "bg-[#fff3ea] ring-[#ffd4b5]" : "bg-white hover:bg-[#fafafa]",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-[15px] font-semibold text-[#222] sm:text-[18px]">{conversation.name}</div>
                    <span className={["rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.06em] sm:px-2.5 sm:py-1 sm:text-[11px] sm:tracking-[0.08em]", getStatusStyles(conversation.status)].join(" ")}>
                      {conversation.status}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-[#999] sm:mt-1 sm:text-[13px]">{conversation.role}</div>
                  <div className="mt-1.5 line-clamp-2 text-[13px] leading-5 text-[#666] sm:mt-2 sm:text-[15px]">{conversation.preview}</div>
                </div>
                <div className="shrink-0 text-[11px] text-[#888] sm:text-[13px]">{conversation.time}</div>
              </div>
            </button>
          ))}

          {filteredEntries.length === 0 ? (
            <div className="rounded-[16px] bg-[#fafafa] px-4 py-5 text-[13px] text-[#666] ring-1 ring-black/5 sm:rounded-[18px] sm:py-6 sm:text-[15px]">
              Aucune conversation trouvee pour cette recherche.
            </div>
          ) : null}
        </div>
      </aside>

      <article className={[
        "flex h-[calc(100vh-124px)] min-h-[560px] flex-col rounded-[22px] bg-white px-3.5 py-4 shadow-[0_8px_30px_rgba(24,39,75,0.05)] ring-1 ring-black/5 sm:h-[calc(100vh-132px)] sm:min-h-[620px] sm:rounded-[28px] sm:px-8 sm:py-7 sm:min-h-[760px] xl:h-[calc(100vh-180px)]",
        mobileView === "chat" ? "flex" : "hidden xl:flex",
      ].join(" ")}>
        <div className="mb-4 flex items-center xl:hidden">
          <button type="button" onClick={() => setMobileView("list")} className="inline-flex items-center gap-2 rounded-full bg-[#f7f7f7] px-3 py-2 text-[12px] font-semibold text-[#222] ring-1 ring-black/5">
            <ChevronLeft className="h-4 w-4" />
            Retour
          </button>
        </div>
        <div className="flex items-start justify-between gap-3 border-b border-[#ececec] pb-4 sm:gap-4 sm:pb-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-[linear-gradient(135deg,#fff2e8,#fff)] ring-1 ring-[#ffd8bf]">
              <Image src={SITE_LOGO_PATH} alt={`${SITE_NAME} logo`} fill className="object-contain p-2" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <div className="text-[18px] font-bold tracking-[-0.04em] text-[#222] sm:text-[28px]">{selectedConversation.name}</div>
              <span className={["rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] sm:px-3 sm:py-1 sm:text-[12px] sm:tracking-[0.08em]", getStatusStyles(selectedConversation.status)].join(" ")}>
                {selectedConversation.status}
              </span>
                {isSyncing ? <span className="text-[11px] font-medium text-[#98a2b3]">sync...</span> : null}
              </div>
              <div className="mt-1 text-[12px] text-[#666] sm:mt-2 sm:text-[15px]">{selectedConversation.role}</div>
              {selectedConversation.email ? <div className="mt-1 text-[11px] text-[#999] sm:text-[13px]">{selectedConversation.email}</div> : null}
            </div>
          </div>
          <div className="hidden rounded-full bg-[#f7f7f7] px-4 py-2 text-[14px] font-semibold text-[#333] ring-1 ring-black/5 sm:block">
            Discussion AfriPay
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-[linear-gradient(180deg,#fff7f1_0%,#ffffff_28%)] py-4 pr-1 [scrollbar-gutter:stable] sm:py-6 sm:pr-3">
          <div className="space-y-3.5 sm:space-y-5">
          {selectedMessages.map((message, index) => (
            <div
              key={message.id ?? `${selectedConversation.id}-${index}`}
              className={["flex gap-3", message.side === "right" ? "justify-end" : "justify-start"].join(" ")}
            >
              {message.side === "left" ? (
                <div className="relative mt-1 h-9 w-9 shrink-0 overflow-hidden rounded-full bg-[linear-gradient(135deg,#fff2e8,#fff)] ring-1 ring-[#ffd8bf]">
                  <Image src={SITE_LOGO_PATH} alt={`${SITE_NAME} logo`} fill className="object-contain p-1.5" />
                </div>
              ) : null}
              <div
                className={[
                  "max-w-[90%] rounded-[18px] px-3 py-2.5 text-[13px] leading-6 shadow-[0_8px_22px_rgba(24,39,75,0.06)] sm:max-w-[70%] sm:rounded-[20px] sm:px-5 sm:py-4 sm:text-[16px] sm:leading-7 md:max-w-[65%]",
                  message.side === "right" ? "rounded-br-[6px] bg-[#dcfce7] text-[#16351f]" : "rounded-tl-[6px] bg-white text-[#333]",
                ].join(" ")}
              >
                <div>{message.text}</div>
                <div className="mt-2 flex items-center justify-end gap-1 text-[11px] text-[#7c8593]">
                  <span>{message.createdAt ? new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(new Date(message.createdAt)) : selectedConversation.time}</span>
                  {message.side === "right" ? <CheckCheck className="h-3.5 w-3.5 text-[#16a34a]" /> : null}
                </div>
              </div>
              {message.side === "right" ? (
                <div className="relative mt-1 h-9 w-9 shrink-0 overflow-hidden rounded-full bg-[linear-gradient(135deg,#fff2e8,#fff)] ring-1 ring-[#ffd8bf]">
                  <Image src={SITE_LOGO_PATH} alt={`${SITE_NAME} logo`} fill className="object-contain p-1.5" />
                </div>
              ) : null}
            </div>
          ))}
          <div ref={messagesEndRef} />
          </div>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            handleSend();
          }}
          className={[
            "rounded-[18px] border px-3 py-2.5 shadow-[0_6px_18px_rgba(24,39,75,0.04)] transition sm:rounded-[22px] sm:px-4 sm:py-3",
            isClosedConversation ? "border-[#e6e8ee] bg-[#f7f8fa]" : "border-[#dfe3eb] bg-white",
          ].join(" ")}
        >
          <div className="flex flex-col gap-3 border-t-0 sm:flex-row sm:items-center sm:justify-between">
            <input
              value={draftMessage}
              onChange={(event) => setDraftMessage(event.target.value)}
              placeholder={
                isClosedConversation
                  ? "Ce dossier est clos. Reouvrez-le via le Service AfriPay pour envoyer un nouveau message."
                  : `Ecrire a ${selectedConversation.name}...`
              }
              disabled={isClosedConversation}
              className="h-10 flex-1 rounded-full bg-transparent px-2.5 text-[13px] outline-none placeholder:text-[#9aa0aa] disabled:cursor-not-allowed sm:h-12 sm:px-3 sm:text-[15px]"
            />

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={isClosedConversation}
                className="inline-flex h-9 items-center gap-2 rounded-full border border-[#e1e5ec] px-3 text-[12px] font-medium text-[#444] transition hover:border-[#ff6a00] hover:text-[#ff6a00] disabled:cursor-not-allowed disabled:opacity-50 sm:h-10 sm:px-4 sm:text-[13px]"
              >
                <Paperclip className="h-4 w-4" />
                <span className="sm:hidden">Fichier</span>
                <span className="hidden sm:inline">Joindre</span>
              </button>
              <button
                type="button"
                disabled={isClosedConversation}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#e1e5ec] text-[#444] transition hover:border-[#ff6a00] hover:text-[#ff6a00] disabled:cursor-not-allowed disabled:opacity-50 sm:h-10 sm:w-10"
                aria-label="Ajouter une image"
              >
                <ImagePlus className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={isClosedConversation}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#e1e5ec] text-[#444] transition hover:border-[#ff6a00] hover:text-[#ff6a00] disabled:cursor-not-allowed disabled:opacity-50 sm:h-10 sm:w-10"
                aria-label="Ajouter un emoji"
              >
                <SmilePlus className="h-4 w-4" />
              </button>

              <div className="ml-auto text-[10px] text-[#88909b] sm:text-[12px]">
                {isClosedConversation ? "Dossier clos" : `${draftMessage.trim().length} caractere(s)`}
              </div>
              <button
                type="submit"
                disabled={!draftMessage.trim() || isClosedConversation}
                className="inline-flex h-9 items-center gap-2 rounded-full bg-[#ff6a00] px-4 text-[13px] font-semibold text-white transition hover:bg-[#ef6100] disabled:cursor-not-allowed disabled:bg-[#ffb88d] sm:h-10 sm:gap-3 sm:px-5 sm:text-[14px]"
              >
                <SendHorizonal className="h-4 w-4" />
                Envoyer
              </button>
            </div>
          </div>
        </form>
      </article>
      </div>
    </section>
  );
}
