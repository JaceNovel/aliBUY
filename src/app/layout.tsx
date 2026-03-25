import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { CartProvider } from "@/components/cart-provider";
import { AssistLoopWidget } from "@/components/assistloop-widget";
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
  return (
    <html suppressHydrationWarning lang="fr-FR" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col"><CartProvider><RouteWarmup />{children}<AssistLoopWidget /></CartProvider></body>
    </html>
  );
}
