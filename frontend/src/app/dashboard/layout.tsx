"use client";

import { useEffect, useState } from "react";

import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { getDashboardStats } from "@/lib/api";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [companyName, setCompanyName] = useState("AfriPay Partner");

  useEffect(() => {
    let alive = true;

    getDashboardStats()
      .then((stats) => {
        if (alive) {
          setCompanyName(stats.companyName);
        }
      })
      .catch(() => undefined);

    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#1e293b_0%,#0f172a_48%,#020617_100%)] text-white">
      <div className="flex min-h-screen">
        <Sidebar open={navigationOpen} onClose={() => setNavigationOpen(false)} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header companyName={companyName} onOpenNavigation={() => setNavigationOpen(true)} />
          <main className="flex-1 px-4 py-6 sm:px-6 xl:px-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}