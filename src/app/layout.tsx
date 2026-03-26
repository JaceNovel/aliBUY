import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Geist } from "next/font/google";
import { CartProvider } from "@/components/cart-provider";
import { AssistLoopWidget } from "@/components/assistloop-widget";
import { RouteWarmup } from "@/components/route-warmup";
import { clerkAppearance } from "@/lib/clerk-theme";
import { SITE_DESCRIPTION, SITE_KEYWORDS, SITE_LOGO_PATH, SITE_NAME, SITE_URL } from "@/lib/site-config";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    images: [
      {
        url: SITE_LOGO_PATH,
        width: 500,
        height: 500,
        alt: `${SITE_NAME} logo`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [SITE_LOGO_PATH],
  },
  icons: {
    icon: [
      { url: SITE_LOGO_PATH, type: "image/png", sizes: "500x500" },
    ],
    shortcut: [SITE_LOGO_PATH],
    apple: [
      { url: SITE_LOGO_PATH, sizes: "500x500", type: "image/png" },
    ],
  },
  manifest: "/manifest.webmanifest",
  robots: {
    index: true,
    follow: true,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}${SITE_LOGO_PATH}`,
  };

  return (
    <html suppressHydrationWarning lang="fr-FR" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <ClerkProvider appearance={clerkAppearance}>
          <CartProvider><RouteWarmup />{children}<AssistLoopWidget /></CartProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
