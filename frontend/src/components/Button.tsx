import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
};

const variantClassName: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "bg-[#6366f1] text-white shadow-[0_20px_45px_rgba(99,102,241,0.35)] hover:scale-[1.01] hover:bg-[#7a7cf7]",
  secondary: "bg-[#16203a] text-[#dbe4ff] ring-1 ring-white/10 hover:scale-[1.01] hover:bg-[#1b2747]",
  ghost: "bg-transparent text-[#94a3b8] ring-1 ring-white/10 hover:bg-white/5 hover:text-white",
};

export function Button({ children, className = "", variant = "primary", type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={[
        "inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold transition duration-200 disabled:cursor-not-allowed disabled:opacity-50",
        variantClassName[variant],
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </button>
  );
}