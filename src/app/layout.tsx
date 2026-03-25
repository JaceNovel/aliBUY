import type { Metadata } from "next";
import { ClerkProvider, Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { Geist } from "next/font/google";
import { CartProvider } from "@/components/cart-provider";
import { AssistLoopWidget } from "@/components/assistloop-widget";
import { RouteWarmup } from "@/components/route-warmup";
import { clerkAppearance } from "@/lib/clerk-theme";
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
      <body className="min-h-full flex flex-col">
        <ClerkProvider appearance={clerkAppearance}>
          <header className="pointer-events-none fixed right-4 top-4 z-[95]">
            <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-[#f0d7c7] bg-white/92 px-2 py-2 shadow-[0_18px_36px_rgba(17,24,39,0.12)] backdrop-blur">
              <Show when="signed-out">
                <SignInButton mode="modal">
                  <button type="button" className="inline-flex h-10 items-center justify-center rounded-full border border-[#d7dce5] px-4 text-[13px] font-semibold text-[#222] transition hover:border-[#ff6a00] hover:text-[#ff6a00]">
                    Se connecter
                  </button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button type="button" className="inline-flex h-10 items-center justify-center rounded-full bg-[#ff6a00] px-4 text-[13px] font-semibold text-white transition hover:bg-[#eb6100]">
                    S&apos;inscrire
                  </button>
                </SignUpButton>
              </Show>
              <Show when="signed-in">
                <UserButton appearance={{ elements: { userButtonAvatarBox: "h-10 w-10 ring-2 ring-[#ffe5d6]" } }} />
              </Show>
            </div>
          </header>
          <CartProvider><RouteWarmup />{children}<AssistLoopWidget /></CartProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
