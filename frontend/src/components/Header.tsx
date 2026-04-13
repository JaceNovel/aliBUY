"use client";

import { Menu, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/Button";

type HeaderProps = {
  companyName: string;
  onOpenNavigation: () => void;
};

export function Header({ companyName, onOpenNavigation }: HeaderProps) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const initials = companyName
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "AP";
  const logout = async () => {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
    } finally {
      router.replace("/");
      router.refresh();
    }
  };

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/10 bg-[#0b1224]/80 px-4 py-4 backdrop-blur xl:px-8">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onOpenNavigation} className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-[#cbd5e1] md:hidden">
          <Menu className="h-5 w-5" />
        </button>
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-[#64748b]">Partner dashboard</div>
          <h1 className="mt-1 text-lg font-semibold text-white">{companyName}</h1>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <div className="text-sm font-semibold text-white">{companyName}</div>
          <div className="text-xs text-[#64748b]">API Partner</div>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#16203a] text-sm font-bold text-[#c7d2fe] ring-1 ring-white/10">
          {initials}
        </div>
        <Button variant="ghost" className="hidden sm:inline-flex" disabled={isLoggingOut} onClick={logout}>
          <LogOut className="h-4 w-4" />
          {isLoggingOut ? "Logout..." : "Logout"}
        </Button>
      </div>
    </header>
  );
}
