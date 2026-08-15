import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  suffix,
  hint,
  trend,
  className,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  hint?: string;
  trend?: "up" | "down" | "flat";
  className?: string;
}) {
  return (
    <div className={cn("card p-4", className)}>
      <p className="font-data text-[11px] tracking-widest text-muted">{label}</p>
      <p className="font-data mt-2 text-2xl leading-none">
        {trend === "up" ? <span className="text-good">↑ </span> : null}
        {trend === "down" ? <span className="text-bad">↓ </span> : null}
        {value}
        {suffix ? <span className="ml-1 text-sm text-muted">{suffix}</span> : null}
      </p>
      {hint ? <p className="mt-1.5 text-xs text-faint">{hint}</p> : null}
    </div>
  );
}
