import type { InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
};

export function Input({ label, hint, className = "", ...props }: InputProps) {
  return (
    <label className="block space-y-2">
      {label ? <span className="text-sm font-medium text-[#cbd5e1]">{label}</span> : null}
      <input
        className={[
          "h-12 w-full rounded-2xl border border-white/10 bg-[#111a31] px-4 text-sm text-white outline-none transition placeholder:text-[#64748b] focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/30",
          className,
        ].join(" ")}
        {...props}
      />
      {hint ? <p className="text-xs text-[#64748b]">{hint}</p> : null}
    </label>
  );
}