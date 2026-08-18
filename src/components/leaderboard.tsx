import { RankBadge } from "@/components/rank-badge";
import type { FriendRanking, SyncRanking } from "@/lib/leaderboard";
import { cn } from "@/lib/utils";

function Position({ index, highlight }: { index: number; highlight: boolean }) {
  return (
    <span
      className={cn(
        "font-data w-6 shrink-0 text-center text-sm tabular-nums",
        index === 0 ? "text-amber" : highlight ? "text-ink-soft" : "text-faint",
      )}
    >
      {index + 1}
    </span>
  );
}

/** Ranked on the SYNC's own shared work, which every member can already see. */
export function SyncLeaderboard({ rankings }: { rankings: SyncRanking[] }) {
  if (rankings.length === 0) return null;

  const anyScheduled = rankings.some((row) => row.scheduled > 0);

  return (
    <section className="card p-5">
      <p className="font-data text-[11px] tracking-widest text-muted">LEADERBOARD</p>
      <p className="mt-1 text-xs text-faint">Share of this SYNC&apos;s shared tasks completed.</p>

      {!anyScheduled ? (
        <p className="mt-4 text-sm text-muted">No shared work has come round yet.</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {rankings.map((row, index) => (
            <li key={row.userId} className="flex items-center gap-3">
              <Position index={index} highlight={row.isYou} />

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className={cn("truncate text-sm", row.isYou ? "text-amber" : "text-ink-soft")}>
                    {row.displayName}
                    {row.isYou ? " (you)" : ""}
                  </span>
                  <span className="font-data shrink-0 text-xs tabular-nums text-muted">
                    {row.completed} / {row.scheduled}
                  </span>
                </div>

                <div className="mt-1.5 flex items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-raised">
                    <div
                      className={cn(
                        "h-full rounded-full transition-[width] duration-500",
                        row.isYou ? "bg-amber" : "bg-line-strong",
                      )}
                      style={{ width: `${row.pct * 100}%` }}
                    />
                  </div>
                  <span className="font-data w-10 text-right text-[11px] tabular-nums text-faint">
                    {Math.round(row.pct * 100)}%
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/**
 * Friends are ranked on rating, not task completion. A friend is only entitled
 * to see name, rank, streak and last active, and a completion percentage would
 * quietly hand over more than that.
 */
export function FriendsLeaderboard({ rankings }: { rankings: FriendRanking[] }) {
  if (rankings.length <= 1) return null;

  return (
    <section className="card p-5">
      <p className="font-data text-[11px] tracking-widest text-muted">LEADERBOARD</p>
      <p className="mt-1 text-xs text-faint">By rating, then streak.</p>

      <ol className="mt-4 space-y-2">
        {rankings.map((row, index) => (
          <li
            key={row.userId}
            className={cn(
              "flex items-center gap-3 rounded-md px-2 py-2",
              row.isYou && "bg-raised/50",
            )}
          >
            <Position index={index} highlight={row.isYou} />

            <span
              className={cn("min-w-0 flex-1 truncate text-sm", row.isYou ? "text-amber" : "text-ink-soft")}
            >
              {row.displayName}
              {row.isYou ? " (you)" : ""}
            </span>

            <RankBadge rating={row.rating} />

            <span className="font-data w-12 text-right text-xs tabular-nums text-muted">
              {row.rating}
            </span>

            <span className="font-data w-12 text-right text-xs tabular-nums text-faint">
              {row.streak}d
            </span>
          </li>
        ))}
      </ol>

      <p className="mt-4 text-xs text-faint">
        Task completion stays private. Friends only ever see rank and streak.
      </p>
    </section>
  );
}
