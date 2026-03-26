"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCheck, EllipsisVertical, ImagePlus, MessageCircleMore, Plus, Search, SendHorizontal, Smile } from "lucide-react";

import { SITE_LOGO_PATH, SITE_NAME } from "@/lib/site-config";

type MessageBubble = {
  id?: string;
  side: "left" | "right";
  text: string;
  createdAt?: string;
};

type SupportConversation = {
  id: string;
  name: string;
  email?: string;
  preview: string;
  time: string;
  status: string;
  role: string;
  aiEnabled?: boolean;
  updatedAt?: string;
  messages: MessageBubble[];
};

function statusPill(status: string) {
  if (status === "dossier clos") {
    return "bg-[#f4f4f5] text-[#52525b]";
  }

  if (status === "en transit") {
    return "bg-[#fff4db] text-[#d97706]";
  }

  return "bg-[#dcfae6] text-[#16a34a]";
}

export function AdminSupportClient({ serviceConversations }: { serviceConversations: SupportConversation[] }) {
  const [query, setQuery] = useState("");
  const [selectedConversationId, setSelectedConversationId] = useState(serviceConversations[0]?.id ?? "");
  const [draftMessage, setDraftMessage] = useState("");
  const [liveConversations, setLiveConversations] = useState(serviceConversations);
  const [isSyncing, setIsSyncing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setLiveConversations(serviceConversations);
  }, [serviceConversations]);

  const filteredConversations = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return liveConversations.filter((conversation) => {
      if (!normalizedQuery) {
        return true;
      }

      return `${conversation.name} ${conversation.email ?? ""} ${conversation.preview}`.toLowerCase().includes(normalizedQuery);
    });
  }, [query, liveConversations]);

  const activeConversation = filteredConversations.find((entry) => entry.id === selectedConversationId) ?? filteredConversations[0] ?? liveConversations[0];
  const activeMessages = activeConversation?.messages ?? [];
  const isClosedConversation = activeConversation?.status === "dossier clos";

  useEffect(() => {
    if (!messagesEndRef.current) {
      return;
    }

    messagesEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [selectedConversationId, activeConversation?.messages]);

  useEffect(() => {
    let cancelled = false;

    const syncConversations = async (showLoader = false) => {
      if (showLoader) {
        setIsSyncing(true);
      }

      try {
        const response = await fetch("/api/admin/support", { cache: "no-store" });
        const payload = await response.json().catch(() => null) as { conversations?: SupportConversation[] } | null;
        const conversations = payload?.conversations;
        if (!response.ok || !conversations || cancelled) {
          return;
        }

        setLiveConversations(conversations);
        setSelectedConversationId((current) => {
          if (current && conversations.some((entry) => entry.id === current)) {
            return current;
          }

          return conversations[0]?.id ?? "";
        });
      } finally {
        if (!cancelled) {
          setIsSyncing(false);
        }
      }
    };

    void syncConversations(true);
    const interval = window.setInterval(() => {
      void syncConversations(false);
    }, 4000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const handleSend = async () => {
    if (!activeConversation || !draftMessage.trim() || isClosedConversation) {
      return;
    }

    const nextMessage = draftMessage.trim();
    setLiveConversations((current) => current.map((conversation) => (
      conversation.id === activeConversation.id
        ? {
            ...conversation,
            preview: nextMessage,
            time: "Envoi...",
            messages: [
              ...conversation.messages,
              { id: `temp-${Date.now()}`, side: "left", text: nextMessage, createdAt: new Date().toISOString() },
            ],
          }
        : conversation
    )));
    setDraftMessage("");

    const response = await fetch("/api/admin/support", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ conversationId: activeConversation.id, text: nextMessage }),
    });

    if (!response.ok) {
      setDraftMessage(nextMessage);
      return;
    }

    const payload = await response.json().catch(() => null) as { conversation?: SupportConversation } | null;
    const conversation = payload?.conversation;
    if (conversation) {
      setLiveConversations((current) => {
        const remaining = current.filter((entry) => entry.id !== conversation.id);
        return [conversation, ...remaining];
      });
    }
  };

  if (!activeConversation) {
    return null;
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[332px_1fr]">
      <section className="flex h-[680px] flex-col overflow-hidden rounded-[18px] border border-[#e7ebf1] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
        <div className="flex items-center gap-3 border-b border-[#edf1f6] p-4">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98a2b3]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher un utilisateur..."
              className="h-11 w-full rounded-[12px] border border-[#e1e6ee] pl-11 pr-4 text-[14px] outline-none focus:border-[#f84557]"
            />
          </div>
          <Link href="/messages?tab=service" className="inline-flex h-11 w-11 items-center justify-center rounded-[12px] bg-[#f84557] text-white transition hover:bg-[#ea3248]">
            <Plus className="h-4 w-4" />
          </Link>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {filteredConversations.map((conversation) => (
            <button
              key={conversation.id}
              type="button"
              onClick={() => setSelectedConversationId(conversation.id)}
              className={[
                "flex w-full items-start gap-3 border-b border-[#edf1f6] px-4 py-4 text-left transition",
                activeConversation.id === conversation.id ? "bg-[#f9fafb]" : "hover:bg-[#f9fafb]",
              ].join(" ")}
            >
              <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-[linear-gradient(135deg,#fff2e8,#fff)] ring-1 ring-[#ffd8bf]">
                <Image src={SITE_LOGO_PATH} alt={`${SITE_NAME} logo`} fill className="object-contain p-2" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[15px] font-semibold text-[#101828]">{conversation.name}</div>
                  <div className="text-[12px] text-[#98a2b3]">{conversation.time}</div>
                </div>
                <div className="truncate text-[12px] text-[#667085]">{conversation.preview}</div>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="flex h-[680px] flex-col overflow-hidden rounded-[18px] border border-[#e7ebf1] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
        <div className="flex items-center justify-between border-b border-[#edf1f6] px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-[linear-gradient(135deg,#fff2e8,#fff)] ring-1 ring-[#ffd8bf]">
              <Image src={SITE_LOGO_PATH} alt={`${SITE_NAME} logo`} fill className="object-contain p-2" />
            </div>
            <div>
              <div className="text-[15px] font-semibold text-[#101828]">{activeConversation.name}</div>
              <div className="text-[12px] text-[#667085]">{activeConversation.email}</div>
            </div>
          </div>

          <div className="flex items-center gap-4 text-[13px] text-[#667085]">
            <span>Réponse AI</span>
            <button type="button" className={["flex h-7 w-12 items-center rounded-full px-1", activeConversation.aiEnabled === false ? "bg-[#d0d5dd]" : "bg-[#f84557]"].join(" ")}>
              <span className={["h-5 w-5 rounded-full bg-white", activeConversation.aiEnabled === false ? "" : "ml-auto"].join(" ")} />
            </button>
            <button type="button" className="text-[#101828]">
              <EllipsisVertical className="h-4 w-4" />
            </button>
            {isSyncing ? <span className="text-[12px] text-[#98a2b3]">sync...</span> : null}
          </div>
        </div>

        <div className="border-b border-[#edf1f6] px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[13px] font-semibold text-[#101828]">{activeConversation.role}</div>
              <div className="mt-1 text-[12px] text-[#667085]">Cette conversation est la même que dans la page Messages, onglet Service AfriPay.</div>
              <div className="mt-1 text-[12px] text-[#667085]">Cette conversation provient du support reconfigure pour les comptes utilisateurs reels.</div>
            </div>
            <div className={["inline-flex rounded-full px-3 py-1 text-[12px] font-semibold uppercase tracking-[0.08em]", statusPill(activeConversation.status)].join(" ")}>{activeConversation.status}</div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-[linear-gradient(180deg,#fff7f1_0%,#ffffff_28%)] px-6 py-5">
          <div className="space-y-4">
            {activeMessages.map((message, index) => (
              <div key={`${activeConversation.id}-${index}`} className={["flex gap-3", message.side === "right" ? "justify-end" : "justify-start"].join(" ")}>
                {message.side === "left" ? (
                  <div className="relative mt-1 h-9 w-9 shrink-0 overflow-hidden rounded-full bg-[linear-gradient(135deg,#fff2e8,#fff)] ring-1 ring-[#ffd8bf]">
                    <Image src={SITE_LOGO_PATH} alt={`${SITE_NAME} logo`} fill className="object-contain p-1.5" />
                  </div>
                ) : null}
                <div className={[
                  "max-w-[470px] rounded-[16px] px-4 py-3 text-[15px] leading-8 text-[#101828] shadow-[0_6px_18px_rgba(15,23,42,0.06)]",
                  message.side === "right" ? "rounded-br-[4px] bg-[#f8fafc]" : "rounded-tl-[4px] bg-[#dcfce7]",
                ].join(" ")}>
                  <div>{message.text}</div>
                  <div className="mt-2 flex items-center justify-end gap-1 text-right text-[12px] text-[#667085]">
                    <span>{message.createdAt ? new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(new Date(message.createdAt)) : activeConversation.time}</span>
                    {message.side === "left" ? <CheckCheck className="h-3.5 w-3.5 text-[#16a34a]" /> : null}
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

        <div className="border-t border-[#edf1f6] px-4 py-4">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-3 rounded-[14px] border border-[#e4e7ec] bg-white px-4 py-3"
          >
            <Smile className="h-5 w-5 text-[#f59e0b]" />
            <input
              value={draftMessage}
              onChange={(event) => setDraftMessage(event.target.value)}
              placeholder={isClosedConversation ? "Conversation clôturée" : "Tapez un message..."}
              disabled={isClosedConversation}
              className="h-8 flex-1 text-[14px] outline-none disabled:cursor-not-allowed"
            />
            <button type="button" className="text-[#101828]" disabled={isClosedConversation}>
              <ImagePlus className="h-4 w-4" />
            </button>
            <button type="submit" disabled={!draftMessage.trim() || isClosedConversation} className="inline-flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#f8b4c3] text-white disabled:cursor-not-allowed disabled:opacity-50">
              <SendHorizontal className="h-4 w-4" />
            </button>
          </form>
          <div className="mt-3 flex items-center justify-between gap-3 text-[12px] text-[#98a2b3]">
            <div className="flex items-center gap-2">
              <MessageCircleMore className="h-4 w-4" />
              Conversation reliée au support client et à la page Messages.
            </div>
            <Link href={`/messages?tab=service&conversationId=${encodeURIComponent(activeConversation.id)}`} className="font-semibold text-[#f84557] transition hover:text-[#ea3248]">
              Ouvrir dans Messages
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
