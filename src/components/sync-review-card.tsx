import type { SyncReview } from "@/lib/sync-review";
import { formatDayKey } from "@/lib/time";
import { cn } from "@/lib/utils";

/**
 * The self-comparison here is the member against their own SYNC history, so it
 * can be shown in a shared room without exposing anyone's personal data. Each
 * member sees only their own line.
 */
export function SyncReviewCard({ review }: { review: SyncReview }) {
  return (
    <section className="card p-5">
      <p className="font-data text-[11px] tracking-widest text-muted">THIS WEEK</p>

      <div className="mt-3 flex flex-wrap items-end gap-x-8 gap-y-3">
        <div>
          <p className="font-data text-3xl leading-none tabular-nums">{review.thisWeek}%</p>
          <p className="mt-1 text-xs text-faint">
            {review.lastWeek > 0 ? `${review.lastWeek}% last week` : "First week"}
          </p>
        </div>

        <div>
          <p
            className={cn(
              "font-data text-lg leading-none tabular-nums",
              review.deltaPoints > 0
                ? "text-good"
                : review.deltaPoints < 0
                  ? "text-bad"
                  : "text-muted",
            )}
          >
            {review.deltaPoints > 0 ? "↑ +" : review.deltaPoints < 0 ? "↓ " : ""}
            {review.deltaPoints === 0 ? "level" : `${Math.abs(review.deltaPoints)}%`}
          </p>
          <p className="mt-1 text-xs text-faint">Week on week</p>
        </div>

        <div>
          <p className="font-data text-lg leading-none tabular-nums">{review.qualifyingDays} / 7</p>
          <p className="mt-1 text-xs text-faint">Days that cleared the bar</p>
        </div>
      </div>

      <dl className="mt-5 space-y-2 border-t border-line pt-4 text-sm">
        {review.mostImproved ? (
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Most improved</dt>
            <dd className="font-data text-right text-ink-soft">
              {review.mostImproved.displayName} · +{review.mostImproved.deltaPoints}%
            </dd>
          </div>
        ) : null}

        {review.bestDay ? (
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Best day</dt>
            <dd className="font-data text-right text-ink-soft">
              {formatDayKey(review.bestDay.date, "EEE d MMM")} ·{" "}
              {Math.round(review.bestDay.ratio * 100)}%
            </dd>
          </div>
        ) : null}

        {review.weakestTask ? (
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Weakest task</dt>
            <dd className="font-data text-right text-ink-soft">
              {review.weakestTask.name} · {Math.round(review.weakestTask.ratio * 100)}%
            </dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-5 border-t border-line pt-4">
        <p className="font-data text-[11px] tracking-widest text-amber">YOU, AGAINST YOURSELF</p>

        {review.you.hasHistory ? (
          <p className="mt-2 text-sm text-ink-soft">
            {review.you.thisWeek}% this week against your own {review.you.trailing}% over the
            previous weeks.{" "}
            <span
              className={
                review.you.deltaPoints > 0
                  ? "text-good"
                  : review.you.deltaPoints < 0
                    ? "text-bad"
                    : "text-muted"
              }
            >
              {review.you.deltaPoints > 0
                ? `Up ${review.you.deltaPoints} points.`
                : review.you.deltaPoints < 0
                  ? `Down ${Math.abs(review.you.deltaPoints)} points.`
                  : "Holding level."}
            </span>
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted">
            {review.you.thisWeek}% this week. Another week of history and this compares you against
            your own pace rather than anyone else&apos;s.
          </p>
        )}

        <p className="mt-2 text-xs text-faint">Only you see this line.</p>
      </div>

      <div className="mt-5 border-t border-line pt-4">
        <p className="font-data text-[11px] tracking-widest text-muted">EVERYONE</p>
        <ul className="mt-3 space-y-2">
          {review.members.map((member) => (
            <li key={member.userId} className="flex items-center gap-3">
              <span className="w-28 shrink-0 truncate text-sm text-ink-soft">
                {member.displayName}
              </span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-raised">
                <span
                  className="block h-full rounded-full bg-line-strong"
                  style={{ width: `${member.pct * 100}%` }}
                />
              </span>
              <span className="font-data w-10 text-right text-xs tabular-nums text-faint">
                {Math.round(member.pct * 100)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
