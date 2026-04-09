import { ClerkProvider } from "@clerk/nextjs";

import { clerkAppearance } from "@/lib/clerk-theme";

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <ClerkProvider appearance={clerkAppearance}>{children}</ClerkProvider>;
}