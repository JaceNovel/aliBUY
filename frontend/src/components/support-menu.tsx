"use client";

import { LifeBuoy, ReceiptText, ShieldAlert, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type SupportMenuProps = {
  triggerLabel?: string;
  className?: string;
  panelClassName?: string;
  align?: "left" | "center" | "right";
};

const supportCards = [
  {
    title: "Assistance commande",
    icon: ReceiptText,
    topic: "order",
  },
  {
    title: "Assistance Remboursement",
    icon: LifeBuoy,
    topic: "refund",
  },
] as const;

const supportLinks = [
  "Ouvrir un litige",
  "Signaler une violation des Droits de Propriete Intellectuelle",
  "Signaler un abus",
];

export function SupportMenu({
  triggerLabel = "Centre de reprise",
  className = "",
  panelClassName = "top-[calc(100%+12px)]",
  align = "right",
}: SupportMenuProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isLaunchingTopic, setIsLaunchingTopic] = useState<string | null>(null);
  const closeTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        window.clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  const showMenu = () => {
    if (closeTimeoutRef.current) {
      window.clearTimeout(closeTimeoutRef.current);
    }

    setIsOpen(true);
  };

  const hideMenu = () => {
    if (closeTimeoutRef.current) {
      window.clearTimeout(closeTimeoutRef.current);
    }

    closeTimeoutRef.current = window.setTimeout(() => {
      setIsOpen(false);
    }, 120);
  };

  const toggleMenu = () => {
    if (closeTimeoutRef.current) {
      window.clearTimeout(closeTimeoutRef.current);
    }

    setIsOpen((current) => !current);
  };

  const launchSupportTopic = async (topic: "order" | "refund") => {
    setIsLaunchingTopic(topic);

    try {
      const response = await fetch("/api/support/quick-start", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ topic }),
      });

      if (response.status === 401) {
        router.push(`/login?next=${encodeURIComponent("/messages")}`);
        return;
      }

      const payload = await response.json().catch(() => null) as { conversationId?: string; message?: string } | null;
      if (!response.ok || !payload?.conversationId) {
        throw new Error(payload?.message || "Impossible d'ouvrir le centre d'assistance.");
      }

      setIsOpen(false);
      router.push(`/messages?tab=service&conversationId=${encodeURIComponent(payload.conversationId)}`);
    } catch (error) {
      router.push(`/messages?tab=service&error=${encodeURIComponent(error instanceof Error ? error.message : "support_unavailable")}`);
    } finally {
      setIsLaunchingTopic(null);
    }
  };

  const alignmentClassName =
    align === "left"
      ? "left-0"
      : align === "right"
        ? "right-0"
        : "left-1/2 -translate-x-1/2";

  return (
    <div className="relative" onMouseEnter={showMenu} onMouseLeave={hideMenu}>
      <button type="button" onClick={toggleMenu} className={className}>
        {triggerLabel}
      </button>

      <div
        className={[
          "absolute z-[125] w-[980px] rounded-b-[10px] border border-[#e5e5e5] bg-white px-8 py-10 shadow-[0_22px_45px_rgba(0,0,0,0.12)] transition-all duration-150",
          alignmentClassName,
          panelClassName,
          isOpen ? "visible translate-y-0 opacity-100" : "invisible -translate-y-1 opacity-0",
        ].join(" ")}
      >
        <div className="grid gap-10 md:grid-cols-[1.15fr_0.95fr]">
          <div className="grid gap-5 sm:grid-cols-2">
            {supportCards.map((card) => {
              const Icon = card.icon;

              return (
                <button
                  key={card.title}
                  type="button"
                  onClick={() => void launchSupportTopic(card.topic)}
                  disabled={isLaunchingTopic !== null}
                  className="flex min-h-[162px] flex-col items-center justify-center rounded-[14px] border border-[#e6e6e6] px-6 text-center transition hover:border-[#ff6a00]/40 hover:bg-[#fffaf6]"
                >
                  <Icon className="h-10 w-10 text-[#222]" />
                  <div className="mt-5 text-[18px] text-[#222]">{isLaunchingTopic === card.topic ? "Ouverture..." : card.title}</div>
                </button>
              );
            })}
          </div>

          <div className="border-l border-[#ececec] pl-10">
            <div className="space-y-8 text-[18px] text-[#222]">
              <div className="flex items-center gap-4">
                <ShieldAlert className="h-5 w-5 text-[#222]" />
                <span>{supportLinks[0]}</span>
              </div>
              <div className="flex items-center gap-4 leading-8">
                <LifeBuoy className="h-5 w-5 shrink-0 text-[#222]" />
                <span>{supportLinks[1]}</span>
              </div>
              <div className="flex items-center gap-4">
                <TriangleAlert className="h-5 w-5 text-[#222]" />
                <span>{supportLinks[2]}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
