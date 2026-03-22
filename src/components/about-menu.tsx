"use client";

import Link from "next/link";
import { ArrowRight, Building2, Globe2, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type AboutMenuProps = {
  triggerLabel?: string;
  className?: string;
  panelClassName?: string;
  align?: "left" | "center" | "right";
};

const aboutHighlights = [
  {
    title: "Marketplace panafricain",
    description: "AfriPay connecte acheteurs, fournisseurs et partenaires logistiques sur un meme espace B2B.",
    icon: Globe2,
    eyebrow: "Reseau fournisseurs",
  },
  {
    title: "Paiement protege",
    description: "Suivi de commande, verification fournisseur et protection jusqu'a la livraison finale.",
    icon: ShieldCheck,
    eyebrow: "Transactions securisees",
  },
  {
    title: "Sourcing accelere",
    description: "Demandes de devis, recommandations locales et coordination directe avec les agents logistiques.",
    icon: Sparkles,
    eyebrow: "Execution rapide",
  },
];

const aboutLinks = [
  { label: "Qui sommes-nous", href: "/" },
  { label: "Nos services B2B", href: "/quotes" },
  { label: "Suivi logistique", href: "/messages" },
  { label: "Assistance client", href: "/orders" },
];

export function AboutMenu({
  triggerLabel = "A Propos",
  className = "",
  panelClassName = "top-[calc(100%+12px)]",
  align = "center",
}: AboutMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
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

  const alignmentClassName =
    align === "left"
      ? "left-0"
      : align === "right"
        ? "right-0"
        : "left-1/2 -translate-x-[58%] 2xl:-translate-x-[56%]";

  return (
    <div className="relative" onMouseEnter={showMenu} onMouseLeave={hideMenu}>
      <button type="button" onClick={toggleMenu} className={className}>
        {triggerLabel}
      </button>

      <div
        className={[
          "absolute z-[125] w-[min(960px,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] rounded-[24px] border border-[#efe6df] bg-[linear-gradient(180deg,#fffdfa_0%,#ffffff_72%)] px-5 py-5 shadow-[0_28px_65px_rgba(45,24,12,0.16)] transition-all duration-150 sm:px-7 sm:py-6",
          alignmentClassName,
          panelClassName,
          isOpen ? "visible translate-y-0 opacity-100" : "invisible -translate-y-1 opacity-0",
        ].join(" ")}
      >
        <div className="grid gap-5 lg:grid-cols-[1.22fr_0.82fr]">
          <div className="min-w-0 rounded-[22px] bg-white/90 px-1 py-1">
            <div className="inline-flex items-center gap-3 rounded-full bg-[#fff2e9] px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#d85300]">
              <Building2 className="h-4 w-4" />
              A Propos d&apos;AfriPay
            </div>
            <h3 className="mt-4 max-w-[560px] text-[26px] font-bold leading-[1.08] tracking-[-0.05em] text-[#222] sm:text-[30px]">
              Une plateforme B2B construite pour le sourcing, le paiement et la logistique.
            </h3>
            <p className="mt-3 max-w-[610px] text-[14px] leading-7 text-[#666] sm:text-[15px]">
              AfriPay centralise les commandes, la messagerie logistique, les devis et la protection des achats pour accelerer les operations commerciales.
            </p>

            <div className="mt-5 flex flex-wrap gap-2.5 text-[12px] font-semibold text-[#6d5a4d]">
              <span className="rounded-full bg-[#fff4ec] px-3 py-1.5 ring-1 ring-[#ffe0ca]">Sourcing usine</span>
              <span className="rounded-full bg-[#fff4ec] px-3 py-1.5 ring-1 ring-[#ffe0ca]">Paiement protege</span>
              <span className="rounded-full bg-[#fff4ec] px-3 py-1.5 ring-1 ring-[#ffe0ca]">Agents logistiques dedies</span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {aboutHighlights.map((item) => {
                const Icon = item.icon;

                return (
                  <div key={item.title} className="rounded-[18px] border border-[#f0ebe6] bg-[#fffdfa] px-4 py-4 shadow-[0_8px_20px_rgba(22,22,22,0.03)]">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#fff0e6] text-[#d85300]">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="mt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#d5661c]">{item.eyebrow}</div>
                    <div className="mt-1.5 text-[16px] font-semibold leading-5 text-[#222]">{item.title}</div>
                    <div className="mt-2 text-[13px] leading-6 text-[#666]">{item.description}</div>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/quotes" className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#ff7a1a_0%,#ea5c00_100%)] px-5 py-3 text-[14px] font-semibold text-white shadow-[0_10px_24px_rgba(234,92,0,0.22)] transition hover:brightness-[0.97]">
                Lancer un devis
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/messages" className="inline-flex items-center gap-2 rounded-full border border-[#ead8ca] bg-white px-5 py-3 text-[14px] font-semibold text-[#2c211b] transition hover:border-[#ff6a00] hover:text-[#ff6a00]">
                Voir le suivi logistique
              </Link>
            </div>
          </div>

          <div className="rounded-[22px] bg-[linear-gradient(155deg,#25130d_0%,#4e2111_42%,#d95c08_100%)] px-5 py-5 text-white shadow-[0_18px_42px_rgba(66,31,12,0.22)]">
            <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-white/72">Navigation rapide</div>
            <div className="mt-3 text-[24px] font-semibold leading-[1.12] tracking-[-0.04em] text-white">
              Un point d&apos;entree unique pour acheter, suivre et securiser vos commandes.
            </div>
            <div className="mt-5 space-y-2.5">
              {aboutLinks.map((item) => (
                <Link key={item.label} href={item.href} className="flex items-center justify-between rounded-[14px] bg-white/10 px-4 py-3 text-[15px] font-medium text-white transition hover:bg-white/16">
                  <span>{item.label}</span>
                  <ArrowRight className="h-4 w-4 text-white/80" />
                </Link>
              ))}
            </div>
            <div className="mt-4 rounded-[18px] border border-white/12 bg-white/10 px-4 py-4 text-[13px] leading-6 text-white/86">
              AfriPay accompagne vos achats de la demande de devis jusqu&apos;a la remise finale, avec un suivi adapte a votre pays et votre devise.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}