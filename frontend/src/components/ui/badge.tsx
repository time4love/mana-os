import { type ReactNode } from "react";

interface BadgeProps {
  children: ReactNode;
  variant?: "default" | "secondary" | "outline";
  className?: string;
}

const variantStyles = {
  default: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  secondary: "bg-neutral-600/30 text-neutral-300 border-neutral-500/30",
  outline: "border border-neutral-500 text-neutral-300",
};

export function Badge({ children, variant = "default", className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-medium ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
