import Image from "next/image";

type PaymentMethodIconKind = "mobile-money" | "pay-on-delivery";

type PaymentMethodIconProps = {
  kind: PaymentMethodIconKind;
  size?: number;
  className?: string;
};

const ICON_PATHS: Record<PaymentMethodIconKind, string> = {
  "mobile-money": "/payment-icons/mobile-money.png",
  "pay-on-delivery": "/payment-icons/pay-on-delivery.png",
};

const ICON_ALTS: Record<PaymentMethodIconKind, string> = {
  "mobile-money": "Mobile Money",
  "pay-on-delivery": "Paiement après livraison",
};

export function PaymentMethodIcon({ kind, size = 20, className }: PaymentMethodIconProps) {
  return (
    <Image
      src={ICON_PATHS[kind]}
      alt={ICON_ALTS[kind]}
      width={size}
      height={size}
      className={className}
      unoptimized
    />
  );
}