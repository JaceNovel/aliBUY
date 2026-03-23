import Link from "next/link";
import { Heart } from "lucide-react";

import { CartPopover } from "@/components/cart-popover";
import { MessagesPopover } from "@/components/messages-popover";
import { ProfileMenu } from "@/components/profile-menu";

type HeaderActionGroupProps = {
  className?: string;
  iconClassName?: string;
  align?: "left" | "center" | "right";
  user?: {
    displayName: string;
    firstName: string;
  } | null;
};

export function HeaderActionGroup({
  className = "flex items-center gap-3 text-[#222]",
  iconClassName = "h-5 w-5",
  align = "right",
  user = null,
}: HeaderActionGroupProps) {
  return (
    <div className={className}>
      <MessagesPopover className={iconClassName} align={align} />
      <Link
        href="/favorites"
        aria-label="Ouvrir les favoris"
        className="inline-flex items-center justify-center text-[#222] transition hover:text-[#ff6a00]"
      >
        <Heart className={iconClassName} />
      </Link>
      <CartPopover className={iconClassName} align={align} />
      <ProfileMenu className={iconClassName} align={align} user={user} />
    </div>
  );
}