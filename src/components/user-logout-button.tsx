"use client";

import { useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";

type UserLogoutButtonProps = {
  className?: string;
  children: ReactNode;
};

export function UserLogoutButton({ className = "", children }: UserLogoutButtonProps) {
  const clerk = useClerk();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    router.prefetch("/");
  }, [router]);

  const handleLogout = async () => {
    setIsSubmitting(true);

    try {
      await clerk.signOut({ redirectUrl: "/" });
    } finally {
      router.replace("/");
      setIsSubmitting(false);
    }
  };

  return (
    <button type="button" onClick={handleLogout} disabled={isSubmitting} className={className}>
      {children}
    </button>
  );
}