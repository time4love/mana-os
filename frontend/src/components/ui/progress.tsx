interface ProgressProps {
  value: number;
  max?: number;
  className?: string;
}

/**
 * Progress bar. value/max as 0–100% fill. Uses logical properties for RTL.
 */
export function Progress({ value, max = 100, className = "" }: ProgressProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      className={`h-2 w-full overflow-hidden rounded-full bg-neutral-700 ${className}`}
    >
      <div
        className="h-full rounded-full bg-emerald-500 transition-all duration-300"
        style={{ inlineSize: `${percentage}%` }}
      />
    </div>
  );
}
