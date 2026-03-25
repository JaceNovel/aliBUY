"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { User } from "lucide-react";

import { UserLogoutButton } from "@/components/user-logout-button";

type ProfileMenuProps = {
  className?: string;
  align?: "left" | "center" | "right";
  user?: {
    displayName: string;
    firstName: string;
  } | null;
};

const profileItems = [
  { label: "Profil", href: "/account" },
  { label: "Adresses", href: "/account/addresses" },
  { label: "Commandes", href: "/orders" },
  { label: "Messages", href: "/messages" },
  { label: "Demandes de devis", href: "/quotes" },
  { label: "Favoris", href: "/favorites" },
  { label: "Compte", href: "/account/compte" },
];

export function ProfileMenu({ className = "", align = "right", user = null }: ProfileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [resolvedUser, setResolvedUser] = useState(user);
  const closeTimeoutRef = useRef<number | null>(null);
  const router = useRouter();

  useEffect(() => {
    setResolvedUser(user);
  }, [user]);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        window.clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    profileItems.forEach((item) => {
      router.prefetch(item.href);
    });
    router.prefetch("/login");
    router.prefetch("/register");
  }, [isOpen, router]);

  useEffect(() => {
    if (user !== null) {
      return;
    }

    let cancelled = false;

    void fetch("/api/account/session", { credentials: "same-origin" })
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => {
        if (cancelled) {
          return;
        }

        const nextUser = payload?.user && typeof payload.user.displayName === "string" && typeof payload.user.firstName === "string"
          ? {
              displayName: payload.user.displayName,
              firstName: payload.user.firstName,
            }
          : null;
        setResolvedUser(nextUser);
      })
      .catch(() => {
        if (!cancelled) {
          setResolvedUser(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

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

  const handleNavigation = () => {
    setIsOpen(false);
  };

  const alignmentClassName =
    align === "left"
      ? "left-0"
      : align === "right"
        ? "right-0"
        : "left-1/2 -translate-x-1/2";

  const arrowClassName =
    align === "left"
      ? "left-6"
      : align === "right"
        ? "right-6"
        : "left-1/2 -translate-x-1/2";

  return (
    <div className="relative" onMouseEnter={showMenu} onMouseLeave={hideMenu}>
      <button
        type="button"
        aria-label="Ouvrir le menu profil"
        onClick={toggleMenu}
        className={["inline-flex items-center justify-center text-[#222] transition hover:text-[#ff6a00]", className].join(" ")}
      >
        <User className="h-6 w-6" />
      </button>

      <div
        className={[
          "absolute top-[calc(100%+16px)] z-[130] w-[404px] rounded-[18px] border border-[#e6e6e6] bg-white px-6 py-5 shadow-[0_22px_46px_rgba(0,0,0,0.15)] transition-all duration-150",
          alignmentClassName,
          isOpen ? "visible translate-y-0 opacity-100" : "invisible -translate-y-1 opacity-0",
        ].join(" ")}
      >
        <div className={["absolute -top-2 h-4 w-4 rotate-45 border-l border-t border-[#e6e6e6] bg-white", arrowClassName].join(" ")} />

        {resolvedUser ? (
          <>
            <div className="flex items-center gap-3 border-b border-[#ededed] pb-5">
              <div className="text-[18px] font-semibold text-[#222]">Bonjour, {resolvedUser.firstName}</div>
            </div>

            <div className="space-y-1 py-5">
              {profileItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={handleNavigation}
                  className="block rounded-[12px] px-2 py-2 text-[18px] text-[#222] transition hover:bg-[#f7f7f7]"
                >
                  {item.label}
                </Link>
              ))}
            </div>

            <div className="border-t border-[#ededed] pt-5">
              <UserLogoutButton className="text-[18px] text-[#222] transition hover:text-[#ff6a00]">
                Se deconnecter
              </UserLogoutButton>
            </div>
          </>
        ) : (
          <>
            <div className="border-b border-[#ededed] pb-5">
              <div className="text-[22px] font-semibold tracking-[-0.03em] text-[#222]">Mon compte</div>
              <p className="mt-2 text-[14px] leading-6 text-[#666]">
                Creez votre compte ou connectez-vous pour acceder a vos commandes, devis, messages et favoris personnels.
              </p>
            </div>

            <div className="space-y-3 py-5">
              <Link href="/login" onClick={handleNavigation} className="inline-flex h-12 w-full items-center justify-center rounded-[14px] bg-[#ff6a00] px-5 text-[16px] font-semibold text-white transition hover:bg-[#eb6100]">
                Se connecter
              </Link>
              <Link href="/register" onClick={handleNavigation} className="inline-flex h-12 w-full items-center justify-center rounded-[14px] border border-[#d7dce5] px-5 text-[16px] font-semibold text-[#222] transition hover:border-[#ff6a00] hover:text-[#ff6a00]">
                S'inscrire
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}