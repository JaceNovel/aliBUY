import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { CartProvider } from "@/components/cart-provider";
import { ClerkCartProvider } from "@/components/clerk-cart-provider";
import { DeferredGlobalWidgets } from "@/components/deferred-global-widgets";
import { getSyncedAccountSettings } from "@/lib/account-settings";
import { isClerkConfigured } from "@/lib/clerk-config";
import { SITE_DESCRIPTION, SITE_KEYWORDS, SITE_LOGO_PATH, SITE_NAME, SITE_SHARE_IMAGE_PATH, SITE_URL } from "@/lib/site-config";
import { getCurrentUser } from "@/lib/user-auth";
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

function normalizeBingEnhancedEmail(value: string | null | undefined) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeBingEnhancedPhone(value: string | null | undefined) {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();
  if (trimmed === "") {
    return "";
  }

  const hasLeadingPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D+/g, "");
  if (digits === "") {
    return "";
  }

  return `${hasLeadingPlus ? "+" : ""}${digits}`;
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const googleTagId = "G-GHCKVT4EDS";
  const googleAdsTagId = "AW-18105145531";
  const bingUetTagId = "97240657";
  const currentUser = await getCurrentUser().catch(() => null);
  const accountSettings = currentUser ? await getSyncedAccountSettings(currentUser).catch(() => null) : null;
  const bingEnhancedEmail = normalizeBingEnhancedEmail(currentUser?.email);
  const bingEnhancedPhone = normalizeBingEnhancedPhone(
    accountSettings?.phone
      ?? accountSettings?.connectedWhatsapp
      ?? accountSettings?.twoFactorPhone
      ?? "",
  );
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
    <ClerkProvider
      signInUrl="/login"
      signUpUrl="/register"
      signInFallbackRedirectUrl="/account"
      signUpFallbackRedirectUrl="/account"
      afterSignOutUrl="/"
      appearance={{ cssLayerName: "clerk" }}
    >
      <ClerkCartProvider>
        {appContent}
      </ClerkCartProvider>
    </ClerkProvider>
  ) : (
    <CartProvider>
      {appContent}
    </CartProvider>
  );

  return (
    <html suppressHydrationWarning lang="fr-FR" className="h-full antialiased">
      <head>
        <script async src={`https://www.googletagmanager.com/gtag/js?id=${googleTagId}`} />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${googleTagId}');
              gtag('config', '${googleAdsTagId}');
            `,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function(w, d, t, u, o) {
                w[u] = w[u] || [];
                o.ts = (new Date()).getTime();
                var n = d.createElement(t);
                n.src = "https://bat.bing.net/bat.js?ti=" + o.ti + ("uetq" != u ? "&q=" + u : "");
                n.async = 1;
                n.onload = n.onreadystatechange = function() {
                  var s = this.readyState;
                  if (!s || s === "loaded" || s === "complete") {
                    o.q = w[u];
                    w[u] = new UET(o);
                    w[u].push("pageLoad");
                    n.onload = n.onreadystatechange = null;
                  }
                };
                var i = d.getElementsByTagName(t)[0];
                i.parentNode.insertBefore(n, i);
              })(window, document, "script", "uetq", {
                ti: "${bingUetTagId}",
                enableAutoSpaTracking: true,
              });
            `,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.uetq = window.uetq || [];
              window.uetq.push('set', { pid: {
                em: ${JSON.stringify(bingEnhancedEmail)},
                ph: ${JSON.stringify(bingEnhancedPhone)}
              } });
            `,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.uetq = window.uetq || [];
              window.uetq.push('consent', 'default', {
                ad_storage: 'denied'
              });
              window.afriGrantBingConsent = function afriGrantBingConsent() {
                window.uetq = window.uetq || [];
                window.uetq.push('consent', 'update', {
                  ad_storage: 'granted'
                });
              };
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify([organizationJsonLd, websiteJsonLd, ...navigationJsonLd]) }}
        />
        {app}
      </body>
    </html>
  );
}
