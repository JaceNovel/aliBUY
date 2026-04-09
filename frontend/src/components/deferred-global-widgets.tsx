"use client";

import dynamic from "next/dynamic";

const RouteWarmup = dynamic(() => import("@/components/route-warmup").then((module) => module.RouteWarmup), { ssr: false });
const AccountPhoneRequiredModal = dynamic(() => import("@/components/account-phone-required-modal").then((module) => module.AccountPhoneRequiredModal), { ssr: false });
const SiteChatWidget = dynamic(() => import("@/components/site-chat-widget").then((module) => module.SiteChatWidget), { ssr: false });

export function DeferredGlobalWidgets() {
  return (
    <>
      <RouteWarmup />
      <AccountPhoneRequiredModal />
      <SiteChatWidget />
    </>
  );
}