import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-raised", className)} />;
}

/** Mirrors the real card's padding so the layout doesn't jump on load. */
export function CardSkeleton({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("card p-5", className)}>
      <Skeleton className="h-2.5 w-24" />
      <Skeleton className="mt-4 h-7 w-40" />
      <div className="mt-5 space-y-2.5">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className="h-3.5" />
        ))}
      </div>
    </div>
  );
}

export function PageSkeleton({ label }: { label: string }) {
  return (
    <div className="space-y-5">
      <span className="sr-only" role="status">
        Loading {label}
      </span>
      <Skeleton className="h-3 w-32" />
      <Skeleton className="h-8 w-56" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-40 lg:col-span-2" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-1">
          <Skeleton className="h-[74px]" />
          <Skeleton className="h-[74px]" />
        </div>
      </div>
      <CardSkeleton lines={5} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    </div>
  );
}
