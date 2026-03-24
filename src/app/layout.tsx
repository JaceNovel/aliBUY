import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Geist } from "next/font/google";
import { CartProvider } from "@/components/cart-provider";
import { RouteWarmup } from "@/components/route-warmup";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Inspired by your history | AfriPay",
  description: "AfriPay marketplace with country-based pricing and a B2B history-page inspired interface in Next.js.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const htmlLang = cookieStore.get("afri_language")?.value === "en" ? "en-US" : "fr-FR";

  return (
    <html suppressHydrationWarning lang={htmlLang} className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col"><CartProvider><RouteWarmup />{children}</CartProvider></body>
    </html>
  );
}
