import {
  ArrowRight,
  CircleDollarSign,
  ShieldCheck,
  Truck,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { getMessages } from "@/lib/messages";

type OrderProtectionMenuProps = {
  triggerLabel?: string;
  triggerClassName?: string;
  panelClassName?: string;
  widthClassName?: string;
  languageCode?: string;
};

export function OrderProtectionMenu({
  triggerLabel,
  triggerClassName = "inline-flex items-center py-1 font-medium text-[#444]",
  panelClassName = "top-[calc(100%+12px)]",
  widthClassName = "w-[1120px]",
  languageCode,
}: OrderProtectionMenuProps) {
  const messages = getMessages(languageCode);
  const resolvedTriggerLabel = triggerLabel ?? messages.nav.orderProtection;
  const featureCards = [
    {
      href: "/protection-commandes#paiements-securises",
      title: messages.orderProtectionPanel.safePayments,
      icon: ShieldCheck,
    },
    {
      href: "/protection-commandes#remboursements",
      title: messages.orderProtectionPanel.refund,
      icon: CircleDollarSign,
    },
    {
      href: "/protection-commandes#logistique",
      title: messages.orderProtectionPanel.logistics,
      icon: Truck,
    },
    {
      href: "/protection-commandes#apres-vente",
      title: messages.orderProtectionPanel.afterSales,
      icon: Wrench,
    },
  ];

  return (
    <div className="group relative">
      <Link href="/protection-commandes" className={triggerClassName}>
        {resolvedTriggerLabel}
      </Link>

      <div
        className={[
          "invisible absolute left-0 z-[120] overflow-hidden rounded-b-[10px] border border-[#ececec] bg-white opacity-0 shadow-[0_22px_45px_rgba(0,0,0,0.12)] transition-all duration-200 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100",
          "-translate-y-1",
          panelClassName,
          widthClassName,
        ].join(" ")}
      >
        <div className="grid min-h-[330px] grid-cols-[0.98fr_1.2fr] gap-8 bg-white px-10 py-9">
          <div className="flex flex-col justify-center">
            <div className="text-[16px] font-semibold text-[#333]">
              {messages.orderProtectionPanel.title}
            </div>

            <h3 className="mt-6 max-w-[440px] text-[30px] font-semibold leading-[1.35] tracking-[-0.05em] text-[#222]">
              {messages.orderProtectionPanel.description}
            </h3>

            <Link href="/protection-commandes" className="mt-8 inline-flex h-11 w-fit items-center justify-center rounded-full bg-[#ff6a00] px-10 text-[15px] font-semibold text-white hover:bg-[#ef6100]">
              {messages.common.learnMore}
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {featureCards.map((card) => {
              const Icon = card.icon;

              return (
                <Link
                  key={card.title}
                  href={card.href}
                  className="flex min-h-[118px] items-center justify-between rounded-[20px] bg-[#f8f8f8] px-7 py-6 transition-colors hover:bg-[#f3f3f3]"
                >
                  <div className="flex items-center gap-5">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#fff0c2] text-[#2a2a2a] ring-6 ring-[#fff7df]">
                      <Icon className="h-8 w-8" />
                    </div>
                    <div className="max-w-[190px] text-[16px] font-medium leading-7 text-[#222]">
                      {card.title}
                    </div>
                  </div>
                  <ArrowRight className="h-7 w-7 shrink-0 text-[#222]" />
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}