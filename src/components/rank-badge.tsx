import { bandProgress, nextTier, ratingToNextTier, tierFor } from "@/lib/rank";
import { cn } from "@/lib/utils";

type Props = {
  rating: number;
  variant?: "hero" | "small";
  className?: string;
};

/**
 * The one component allowed to glow. Hero owns the dashboard; small is used in
 * friend cards, SYNC Room member lists and anywhere rank is metadata.
 */
export function RankBadge({ rating, variant = "small", className }: Props) {
  const tier = tierFor(rating);
  const style = { "--rank-color": `var(${tier.color})` } as React.CSSProperties;

  if (variant === "small") {
    return (
      <span
        style={style}
        className={cn("font-data inline-flex items-center gap-1.5 text-xs", className)}
      >
        <span
          aria-hidden
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: "var(--rank-color)" }}
        />
        <span style={{ color: "var(--rank-color)" }}>{tier.label}</span>
      </span>
    );
  }

  const next = nextTier(rating);
  const remaining = ratingToNextTier(rating);
  const progress = bandProgress(rating);

  return (
    <div style={style} className={cn("card rank-glow p-5 sm:p-6", className)}>
      <p className="font-data text-[11px] tracking-widest text-muted">RANK</p>

      <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2
          className="font-data text-3xl leading-none font-semibold sm:text-4xl"
          style={{ color: "var(--rank-color)" }}
        >
          {tier.label}
        </h2>
        <span className="font-data text-lg text-ink-soft">{rating}</span>
      </div>

      <div className="mt-5">
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-raised"
          role="progressbar"
          aria-valuenow={Math.round(progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={next ? `Progress to ${next.label}` : "Top rank reached"}
        >
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{ width: `${progress * 100}%`, background: "var(--rank-color)" }}
          />
        </div>

        <p className="font-data mt-2 text-xs text-muted">
          {next ? (
            <>
              {remaining} rating to <span className="text-ink-soft">{next.label}</span>
            </>
          ) : (
            "Top rank reached"
          )}
        </p>
      </div>
    </div>
  );
}
