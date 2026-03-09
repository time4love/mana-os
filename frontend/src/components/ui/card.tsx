import { type ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={`rounded-lg border border-neutral-700 bg-neutral-900/50 text-neutral-100 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = "" }: CardProps) {
  return <div className={`flex flex-col gap-1.5 p-6 ${className}`}>{children}</div>;
}

export function CardTitle({ children, className = "" }: CardProps) {
  return <h3 className={`text-lg font-semibold leading-none ${className}`}>{children}</h3>;
}

export function CardContent({ children, className = "" }: CardProps) {
  return <div className={`p-6 pt-0 ${className}`}>{children}</div>;
}
