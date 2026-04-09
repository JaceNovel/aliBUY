import { ClerkProvider } from "@clerk/nextjs";

import { clerkAppearance } from "@/lib/clerk-theme";

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return <ClerkProvider appearance={clerkAppearance}>{children}</ClerkProvider>;
}