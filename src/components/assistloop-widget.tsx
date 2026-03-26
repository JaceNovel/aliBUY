"use client";

import Image from "next/image";
import { MessageCircleMore } from "lucide-react";
import { useRef, useState } from "react";
import Script from "next/script";

import { SITE_LOGO_PATH, SITE_NAME } from "@/lib/site-config";

declare global {
  interface Window {
    AssistLoopWidget?: {
      init?: (config: { agentId?: string }) => void;
      hide?: () => void;
      show?: () => void;
      close?: () => void;
      destroy?: () => void;
    };
  }
}

export function AssistLoopWidget() {
  const hasInitializedRef = useRef(false);
  const [isReady, setIsReady] = useState(false);
  const agentId = process.env.NEXT_PUBLIC_ASSISTLOOP_AGENT_ID;

  if (!agentId) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        aria-label="Ouvrir le chat AfriPay"
        onClick={() => {
          if (typeof window === "undefined") {
            return;
          }

          window.AssistLoopWidget?.show?.();
        }}
        className="fixed bottom-[calc(var(--mobile-bottom-nav-height)+18px)] right-3 z-[120] inline-flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-[0_16px_28px_rgba(250,100,0,0.24)] ring-1 ring-[#ffd8c1] transition hover:-translate-y-0.5 hover:shadow-[0_20px_34px_rgba(250,100,0,0.32)] sm:bottom-5 sm:right-5 sm:h-16 sm:w-16"
      >
        <Image
          src={SITE_LOGO_PATH}
          alt={`${SITE_NAME} chat`}
          width={40}
          height={40}
          className="h-9 w-9 object-contain sm:h-11 sm:w-11"
        />
        {!isReady ? <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#fa6400] text-white"><MessageCircleMore className="h-3 w-3" /></span> : null}
      </button>

      <Script
        src="https://assistloop.ai/assistloop-widget.js"
        strategy="lazyOnload"
        onLoad={() => {
          if (typeof window === "undefined") {
            return;
          }

          const ensureWidgetReady = () => {
            const widget = window.AssistLoopWidget;
            if (!widget) {
              return;
            }

            if (!hasInitializedRef.current) {
              widget.init?.({ agentId });
              widget.hide?.();
              hasInitializedRef.current = true;
              setIsReady(true);
              return;
            }

            setIsReady(true);
          };

          ensureWidgetReady();
        }}
      />
    </>
  );
}
