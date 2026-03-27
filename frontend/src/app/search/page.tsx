import { redirect } from "next/navigation";

import { FREE_DEAL_ROUTE, isFreeDealSearchQuery } from "@/lib/free-deal-constants";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  if (isFreeDealSearchQuery(q)) {
    redirect(FREE_DEAL_ROUTE);
  }

  redirect(`/quotes${q ? `?q=${encodeURIComponent(q)}` : ""}`);
}
