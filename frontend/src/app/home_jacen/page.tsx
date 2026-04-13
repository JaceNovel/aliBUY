import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { isAdminAuthenticated } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "Acces prive",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function HiddenAdminLoginPage() {
  if (await isAdminAuthenticated()) {
    redirect("/admin");
  }

  redirect("/admin-login");
}