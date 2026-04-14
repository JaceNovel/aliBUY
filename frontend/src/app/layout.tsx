import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { CartProvider } from "@/components/cart-provider";
import { ClerkCartProvider } from "@/components/clerk-cart-provider";
import { DeferredGlobalWidgets } from "@/components/deferred-global-widgets";
import { isClerkConfigured } from "@/lib/clerk-config";
import { SITE_DESCRIPTION, SITE_KEYWORDS, SITE_LOGO_PATH, SITE_NAME, SITE_SHARE_IMAGE_PATH, SITE_URL } from "@/lib/site-config";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  icons: {
    icon: [{ url: SITE_LOGO_PATH, type: "image/png" }],
    shortcut: [{ url: SITE_LOGO_PATH, type: "image/png" }],
    apple: [{ url: SITE_LOGO_PATH, type: "image/png" }],
  },
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
        url: SITE_SHARE_IMAGE_PATH,
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} logo`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [SITE_SHARE_IMAGE_PATH],
  },
  manifest: "/manifest.webmanifest",
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#fa6400",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const primaryNavigation = [
    { name: "Tous les produits", url: `${SITE_URL}/products` },
    { name: "Categories", url: `${SITE_URL}/categories` },
    { name: "Tarifs", url: `${SITE_URL}/pricing` },
    { name: "Protection des commandes", url: `${SITE_URL}/protection-commandes` },
    { name: "Devis", url: `${SITE_URL}/quotes` },
  ];

  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}${SITE_LOGO_PATH}`,
  };
  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE_URL}/search?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
  const navigationJsonLd = primaryNavigation.map((item) => ({
    "@context": "https://schema.org",
    "@type": "SiteNavigationElement",
    name: item.name,
    url: item.url,
  }));

  const appContent = (
    <>
      <DeferredGlobalWidgets />
      {children}
    </>
  );
  const clerkEnabled = isClerkConfigured();
  const app = clerkEnabled ? (
    <ClerkCartProvider>
      {appContent}
    </ClerkCartProvider>
  ) : (
    <CartProvider>
      {appContent}
    </CartProvider>
  );

  const document = (
    <html suppressHydrationWarning lang="fr-FR" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify([organizationJsonLd, websiteJsonLd, ...navigationJsonLd]) }}
        />
        {app}
      </body>
    </html>
  );

  return clerkEnabled ? (
    <ClerkProvider
      signInUrl="/login"
      signUpUrl="/register"
      signInFallbackRedirectUrl="/account"
      signUpFallbackRedirectUrl="/account"
      afterSignOutUrl="/"
    >
      {document}
    </ClerkProvider>
  ) : document;
}
