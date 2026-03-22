import { redirect } from "next/navigation";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  redirect(`/products${q ? `?q=${encodeURIComponent(q)}` : ""}`);
}