import { DIFFICULTY_LABELS, PLATFORM_LABELS } from "@/lib/problem-urls";
import type { ProblemStats } from "@/lib/problems";
import { cn } from "@/lib/utils";

const DIFFICULTY_CLASS = {
  EASY: "bg-good",
  MEDIUM: "bg-warn",
  HARD: "bg-bad",
} as const;

export function ProblemAnalytics({ stats }: { stats: ProblemStats }) {
  if (stats.total === 0) return null;

  const delta = stats.thisWeek - stats.lastWeek;
  const busiest = Math.max(1, ...stats.lastSevenDays.map((day) => day.solved));

  return (
    <section className="card p-5">
      <p className="font-data text-[11px] tracking-widest text-muted">PROBLEMS SOLVED</p>

      <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="TOTAL" value={String(stats.solved)} />
        <Stat label="THIS WEEK" value={String(stats.thisWeek)} />
        <Stat
          label="VS LAST WEEK"
          value={`${delta > 0 ? "+" : ""}${delta}`}
          tone={delta > 0 ? "good" : delta < 0 ? "bad" : undefined}
        />
        <Stat label="UNSOLVED" value={String(stats.total - stats.solved)} />
      </div>

      <div className="mt-5 border-t border-line pt-4">
        <p className="font-data text-[10px] tracking-widest text-faint">LAST 7 DAYS</p>
        <div className="mt-3 flex items-end gap-1.5">
          {stats.lastSevenDays.map((day) => (
            <div key={day.date} className="flex flex-1 flex-col items-center gap-1.5">
              <span
                className={cn(
                  "w-full rounded-sm",
                  day.solved > 0 ? "bg-amber" : "bg-raised",
                )}
                style={{ height: `${Math.max(4, (day.solved / busiest) * 48)}px` }}
                title={`${day.date}: ${day.solved}`}
              />
              <span className="font-data text-[9px] tabular-nums text-faint">{day.solved}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 border-t border-line pt-4">
        <p className="font-data text-[10px] tracking-widest text-faint">BY PLATFORM</p>
        <ul className="mt-3 space-y-2">
          {stats.byPlatform.map((entry) => (
            <li key={entry.platform} className="flex items-center gap-3">
              <span className="w-28 shrink-0 truncate text-sm text-ink-soft">
                {PLATFORM_LABELS[entry.platform]}
              </span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-raised">
                <span
                  className="block h-full rounded-full bg-amber"
                  style={{ width: `${entry.total === 0 ? 0 : (entry.solved / entry.total) * 100}%` }}
                />
              </span>
              <span className="font-data w-14 text-right text-xs tabular-nums text-muted">
                {entry.solved} / {entry.total}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {stats.byDifficulty.length > 0 ? (
        <div className="mt-5 border-t border-line pt-4">
          <p className="font-data text-[10px] tracking-widest text-faint">BY DIFFICULTY</p>
          <div className="mt-3 flex gap-2">
            {stats.byDifficulty.map((entry) => (
              <div key={entry.difficulty} className="flex-1">
                <div className="flex items-baseline justify-between">
                  <span className="font-data text-[10px] tracking-widest text-muted">
                    {DIFFICULTY_LABELS[entry.difficulty].toUpperCase()}
                  </span>
                  <span className="font-data text-sm tabular-nums">{entry.solved}</span>
                </div>
                <span
                  className={cn("mt-1.5 block h-1 rounded-full", DIFFICULTY_CLASS[entry.difficulty])}
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {stats.byTopic.length > 0 ? (
        <div className="mt-5 border-t border-line pt-4">
          <p className="font-data text-[10px] tracking-widest text-faint">BY TOPIC</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {stats.byTopic.map((entry) => (
              <span
                key={entry.topic}
                className="font-data rounded-full border border-line px-2.5 py-1 text-[11px] text-muted"
              >
                {entry.topic} <span className="text-ink-soft">{entry.solved}</span>
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad";
}) {
  return (
    <div>
      <p className="font-data text-[10px] tracking-widest text-faint">{label}</p>
      <p
        className={cn(
          "font-data mt-1 text-lg tabular-nums",
          tone === "good" && "text-good",
          tone === "bad" && "text-bad",
        )}
      >
        {value}
      </p>
    </div>
  );
}
