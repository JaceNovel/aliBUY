export function hasValidClerkPublishableKey() {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() || "";
  return publishableKey.startsWith("pk_test_") || publishableKey.startsWith("pk_live_");
}

export function hasValidClerkSecretKey() {
  const secretKey = process.env.CLERK_SECRET_KEY?.trim() || "";
  return secretKey.startsWith("sk_test_") || secretKey.startsWith("sk_live_");
}

export function isClerkConfigured() {
  return hasValidClerkPublishableKey() && hasValidClerkSecretKey();
}
