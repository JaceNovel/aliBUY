"use client";

import { useRef } from "react";
import Script from "next/script";

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
  const agentId = process.env.NEXT_PUBLIC_ASSISTLOOP_AGENT_ID;

  if (!agentId) {
    return null;
  }

  return (
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
            hasInitializedRef.current = true;
            return;
          }

          widget.show?.();
        };

        ensureWidgetReady();
      }}
    />
  );
}