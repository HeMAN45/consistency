import type { Season } from "@/lib/sync-rules";
import { cn } from "@/lib/utils";

export function SeasonBanner({
  season,
  summary,
}: {
  season: Season;
  summary: {
    from: string;
    to: string;
    standings: { displayName: string; done: number; total: number; pct: number }[];
  } | null;
}) {
  if (season.status === "none") return null;

  if (season.status === "ended") {
    return (
      <section className="card p-5">
        <p className="font-data text-[11px] tracking-widest text-muted">SEASON CLOSED</p>
        <h2 className="mt-1 text-lg font-semibold tracking-[-0.02em]">
          {season.totalDays ? `${season.totalDays} days, finished.` : "Finished."}
        </h2>

        {summary && summary.standings.length > 0 ? (
          <ol className="mt-4 space-y-2">
            {summary.standings.map((row, index) => (
              <li key={row.displayName} className="flex items-center gap-3">
                <span
                  className={cn(
                    "font-data w-5 text-center text-sm tabular-nums",
                    index === 0 ? "text-amber" : "text-faint",
                  )}
                >
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">{row.displayName}</span>
                <span className="font-data text-xs tabular-nums text-muted">
                  {row.done} / {row.total}
                </span>
                <span className="font-data w-10 text-right text-xs tabular-nums text-ink-soft">
                  {Math.round(row.pct * 100)}%
                </span>
              </li>
            ))}
          </ol>
        ) : null}

        <p className="mt-4 text-xs text-faint">
          The record is closed. Nothing more can be logged against it.
        </p>
      </section>
    );
  }

  if (season.status === "upcoming") {
    return (
      <section className="card p-4">
        <p className="font-data text-[11px] tracking-widest text-muted">
          SEASON STARTS SOON · {season.totalDays} DAYS
        </p>
      </section>
    );
  }

  const progress =
    season.dayNumber && season.totalDays ? Math.min(1, season.dayNumber / season.totalDays) : 0;

  return (
    <section className="card p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-data text-[11px] tracking-widest text-muted">
          {season.dayNumber && season.totalDays
            ? `DAY ${season.dayNumber} OF ${season.totalDays}`
            : "SEASON RUNNING"}
        </p>
        {season.daysRemaining !== null ? (
          <p className="font-data text-[11px] tabular-nums text-faint">
            {season.daysRemaining} LEFT
          </p>
        ) : null}
      </div>

      {season.totalDays ? (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-raised">
          <div
            className="h-full rounded-full bg-line-strong"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      ) : null}
    </section>
  );
}
