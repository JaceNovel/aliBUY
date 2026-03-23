"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ImagePlus, MessageSquareText, Paperclip, Search, SendHorizonal, SmilePlus, Star } from "lucide-react";

type MessageBubble = {
  side: "left" | "right";
  text: string;
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
  const [conversationMessages, setConversationMessages] = useState<Record<string, MessageBubble[]>>(() => {
    return Object.fromEntries(conversations.map((entry) => [entry.id, entry.messages]));
  });

  const filteredEntries = useMemo(() => {
    const normalizedQuery = searchTerm.trim().toLowerCase();

    return conversations.filter((entry) => {
      if (!normalizedQuery) {
        return true;
      }

      return `${entry.name} ${entry.role} ${entry.preview}`.toLowerCase().includes(normalizedQuery);
    });
  }, [conversations, searchTerm]);

  const selectedConversation =
    filteredEntries.find((entry) => entry.id === selectedConversationId) ?? filteredEntries[0] ?? conversations[0];

  if (!selectedConversation) {
    return (
      <section className="rounded-[24px] bg-white px-6 py-8 shadow-[0_8px_30px_rgba(24,39,75,0.05)] ring-1 ring-black/5">
        <h1 className="text-[24px] font-bold text-[#222]">Messages</h1>
        <p className="mt-3 text-[15px] text-[#666]">Aucune conversation n&apos;est encore disponible pour ce compte.</p>
      </section>
    );
  }

  const selectedMessages = conversationMessages[selectedConversation.id] ?? selectedConversation.messages;
  const isClosedConversation = selectedConversation.status === "dossier clos";

  const handleSend = async () => {
    const nextMessage = draftMessage.trim();

    if (!nextMessage || isClosedConversation) {
      return;
    }

    const optimisticMessages = [
      ...selectedMessages,
      { side: "right" as const, text: nextMessage },
    ];

    setConversationMessages((current) => ({
      ...current,
      [selectedConversation.id]: optimisticMessages,
    }));
    setDraftMessage("");

    const response = await fetch("/api/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ conversationId: selectedConversation.id, text: nextMessage }),
    });

    if (!response.ok) {
      setConversationMessages((current) => ({
        ...current,
        [selectedConversation.id]: selectedMessages,
      }));
      setDraftMessage(nextMessage);
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
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="text-[18px] font-bold tracking-[-0.04em] text-[#222] sm:text-[28px]">{selectedConversation.name}</div>
              <span className={["rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] sm:px-3 sm:py-1 sm:text-[12px] sm:tracking-[0.08em]", getStatusStyles(selectedConversation.status)].join(" ")}>
                {selectedConversation.status}
              </span>
            </div>
            <div className="mt-1 text-[12px] text-[#666] sm:mt-2 sm:text-[15px]">{selectedConversation.role}</div>
            {selectedConversation.email ? <div className="mt-1 text-[11px] text-[#999] sm:text-[13px]">{selectedConversation.email}</div> : null}
          </div>
          <div className="hidden rounded-full bg-[#f7f7f7] px-4 py-2 text-[14px] font-semibold text-[#333] ring-1 ring-black/5 sm:block">
            Chat Direct
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto py-4 pr-1 [scrollbar-gutter:stable] sm:py-6 sm:pr-3">
          <div className="space-y-3.5 sm:space-y-5">
          {selectedMessages.map((message, index) => (
            <div
              key={`${selectedConversation.id}-${index}`}
              className={[
                "max-w-[90%] rounded-[18px] px-3 py-2.5 text-[13px] leading-6 sm:max-w-[70%] sm:rounded-[20px] sm:px-5 sm:py-4 sm:text-[16px] sm:leading-7 md:max-w-[65%]",
                message.side === "right" ? "ml-auto bg-[#fff0e6] text-[#222]" : "bg-[#f5f5f5] text-[#333]",
              ].join(" ")}
            >
              {message.text}
            </div>
          ))}
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