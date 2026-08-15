import { cn } from "@/lib/utils";

/**
 * Temporary. Every nav destination resolves to something during the phased
 * build instead of a 404. Each page is replaced by the real feature in its
 * phase and this component is deleted at the end of Phase 8.
 */
export function PhasePlaceholder({
  title,
  phase,
  description,
  className,
}: {
  title: string;
  phase: string;
  description: string;
  className?: string;
}) {
  return (
    <div className={cn("card flex flex-col items-start p-8", className)}>
      <p className="font-data text-[11px] tracking-widest text-amber">{phase}</p>
      <h1 className="font-data mt-2 text-2xl tracking-tight">{title}</h1>
      <p className="mt-2 max-w-md text-sm text-muted">{description}</p>
    </div>
  );
}
