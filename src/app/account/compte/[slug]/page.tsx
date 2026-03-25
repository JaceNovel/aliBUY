import { notFound, redirect } from "next/navigation";

import { accountPageMeta, type AccountPageSlug } from "@/app/account/compte/account-links";
import { AccountSettingDetailClient } from "@/components/account-setting-detail-client";
import { InternalPageShell } from "@/components/internal-page-shell";
import { getAccountSettings } from "@/lib/account-settings-store";
import { getCurrentUser } from "@/lib/user-auth";
import { getPricingContext } from "@/lib/pricing";

export async function generateStaticParams() {
  return Object.keys(accountPageMeta).map((slug) => ({ slug }));
}

export default async function AccountSettingDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const pricing = await getPricingContext();
  const user = await getCurrentUser();
  const { slug } = await params;
  const page = accountPageMeta[slug as AccountPageSlug];

  if (!user) {
    redirect(`/login?next=/account/compte/${slug}`);
  }

  if (!page) {
    notFound();
  }

  const initialSettings = await getAccountSettings(user.id);

  return (
    <InternalPageShell pricing={pricing}>
      <AccountSettingDetailClient
        slug={slug as AccountPageSlug}
        page={page}
        initialUser={{
          email: user.email,
          displayName: user.displayName,
          firstName: user.firstName,
          createdAt: user.createdAt,
          authProvider: user.authProvider,
        }}
        initialSettings={initialSettings}
      />
    </InternalPageShell>
  );
}
