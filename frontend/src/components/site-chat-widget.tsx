"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle, X } from "lucide-react";
import { useState } from "react";

import { SITE_NAME } from "@/lib/site-config";

const WHATSAPP_ICON_PATH = "/WhatsApp_Image_2026-03-22_at_03.03.05-removebg-preview.png";
const WHATSAPP_CONTACT_URL = "https://wa.me/3584573963223";

export function SiteChatWidget() {
  const pathname = usePathname();
  const isFreeDealRoute = pathname.startsWith("/articles-gratuits");
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <section
        className={[
          "fixed inset-x-4 bottom-[calc(var(--mobile-bottom-nav-height)+var(--mobile-floating-cta-height)+18px)] z-[140] overflow-hidden rounded-[24px] border border-[#d8f0df] bg-white shadow-[0_20px_50px_rgba(0,0,0,0.16)] transition duration-200 ease-out sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[360px]",
          isFreeDealRoute ? "hidden sm:block" : "",
          isOpen ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none translate-y-5 opacity-0",
        ].join(" ")}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#eef3ef] px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-[#fff8f2] ring-1 ring-[#f0f0f0]">
              <Image src={WHATSAPP_ICON_PATH} alt={`${SITE_NAME} WhatsApp`} width={48} height={48} className="h-10 w-10 object-contain" />
            </div>
            <div>
              <div className="text-sm font-semibold text-[#111827]">Chat AfriPay</div>
              <div className="text-xs text-[#16a34a]">En ligne sur WhatsApp</div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="Fermer le chat"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#f7f7f7] text-[#4b5563] transition hover:bg-[#efefef]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-4 py-4">
          <div className="rounded-[20px] bg-[#f6fbf7] px-4 py-4 text-sm leading-6 text-[#111827] ring-1 ring-[#e5f3e8]">
            Avez vous besoin d&apos;aide ? Contactez Nous.
          </div>

          <Link
            href={WHATSAPP_CONTACT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#16a34a] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#12833b]"
          >
            <MessageCircle className="h-4 w-4" />
            Contactez Nous
          </Link>
        </div>
      </section>

      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        aria-label={isOpen ? "Fermer le chat WhatsApp" : "Ouvrir le chat WhatsApp"}
        className={[
          "fixed bottom-[calc(var(--mobile-bottom-nav-height)+var(--mobile-floating-cta-height)+18px)] right-3 z-[135] inline-flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-white shadow-[0_14px_34px_rgba(0,0,0,0.18)] ring-1 ring-[#ebebeb] transition hover:-translate-y-0.5 sm:bottom-6 sm:right-6 sm:h-16 sm:w-16",
          isFreeDealRoute ? "hidden sm:inline-flex" : "",
        ].join(" ")}
      >
        <Image src={WHATSAPP_ICON_PATH} alt={`${SITE_NAME} WhatsApp`} width={64} height={64} className="h-full w-full object-cover" />
      </button>
    </>
  );
}
