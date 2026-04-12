import type { Metadata } from "next";

import { PublicDocsClient } from "@/app/docs/public-docs-client";
import { SITE_NAME } from "@/lib/site-config";

export const metadata: Metadata = {
  title: `Documentation API | ${SITE_NAME}`,
  description: "Documentation publique d'intégration AfriPay pour les partenaires et développeurs.",
};

export default function DocsPage() {
  return <PublicDocsClient />;
}