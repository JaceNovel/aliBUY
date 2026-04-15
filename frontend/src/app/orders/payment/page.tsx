import { redirect } from "next/navigation";

export default async function OrderPaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string; paymentId?: string; paymentStatus?: string; status?: string; provider?: string; token?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const ordersUrl = new URL("/orders", "https://afripay.local");
  if (resolvedSearchParams.orderId) {
    ordersUrl.searchParams.set("orderId", resolvedSearchParams.orderId);
  }
  if (resolvedSearchParams.paymentId) {
    ordersUrl.searchParams.set("paymentId", resolvedSearchParams.paymentId);
  }
  if (resolvedSearchParams.token) {
    ordersUrl.searchParams.set("token", resolvedSearchParams.token);
  }
  if (resolvedSearchParams.paymentStatus) {
    ordersUrl.searchParams.set("paymentStatus", resolvedSearchParams.paymentStatus);
  }
  if (resolvedSearchParams.status) {
    ordersUrl.searchParams.set("status", resolvedSearchParams.status);
  }
  if (resolvedSearchParams.provider) {
    ordersUrl.searchParams.set("provider", resolvedSearchParams.provider);
  }
  redirect(`${ordersUrl.pathname}${ordersUrl.search}`);
}
