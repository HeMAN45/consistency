"use client";

import { useState } from "react";

import type { HeatmapDay } from "@/lib/analytics";
import { cn } from "@/lib/utils";

/** Five steps, so a 40% day and an 80% day are visibly different. */
function levelFor(day: HeatmapDay): number {
  if (!day.hasData) return 0;
  if (day.completionPct >= 1) return 4;
  if (day.completionPct >= 0.75) return 3;
  if (day.completionPct >= 0.5) return 2;
  if (day.completionPct > 0) return 1;
  return 0;
}

const LEVEL_CLASS = [
  "bg-raised",
  "bg-amber/20",
  "bg-amber/40",
  "bg-amber/65",
  "bg-amber",
];

export function Heatmap({ days }: { days: HeatmapDay[] }) {
  const [selected, setSelected] = useState<HeatmapDay | null>(null);

  // Columns of 7, oldest first, so the grid reads left to right like a calendar.
  const weeks: HeatmapDay[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  return (
    <section className="card p-5">
      <div className="flex items-baseline justify-between">
        <p className="font-data text-[11px] tracking-widest text-muted">LAST 90 DAYS</p>
        <p className="font-data text-[11px] text-faint">Tap a day</p>
      </div>

      <div className="mt-4 overflow-x-auto pb-1">
        <div className="flex gap-[3px]">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {week.map((day) => {
                const level = levelFor(day);
                const active = selected?.date === day.date;
                return (
                  <button
                    key={day.date}
                    type="button"
                    onClick={() => setSelected(active ? null : day)}
                    aria-label={`${day.date}, ${Math.round(day.completionPct * 100)}% complete`}
                    title={`${day.date} · ${Math.round(day.completionPct * 100)}%`}
                    className={cn(
                      "h-3.5 w-3.5 rounded-[3px] transition-transform",
                      LEVEL_CLASS[level],
                      active && "ring-2 ring-ink ring-offset-1 ring-offset-surface",
                      day.perfectDay && "shadow-[0_0_8px_-2px_var(--color-amber)]",
                    )}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span className="font-data text-[10px] text-faint">LESS</span>
        {LEVEL_CLASS.map((cls, i) => (
          <span key={i} className={cn("h-2.5 w-2.5 rounded-[2px]", cls)} />
        ))}
        <span className="font-data text-[10px] text-faint">MORE</span>
      </div>

      {selected ? (
        <div className="mt-5 border-t border-line pt-4">
          <p className="font-data text-sm text-ink">{selected.date}</p>

          {selected.hasData ? (
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
              <Detail label="Completion" value={`${Math.round(selected.completionPct * 100)}%`} />
              <Detail label="Core tasks" value={`${selected.coreCompleted} / ${selected.coreTotal}`} />
              <Detail
                label="Steps"
                value={selected.steps === null ? "—" : selected.steps.toLocaleString("en-IN")}
              />
              <Detail label="Wake" value={selected.wakeTime ?? "—"} />
            </dl>
          ) : (
            <p className="mt-2 text-sm text-muted">Nothing was scheduled or logged that day.</p>
          )}
        </div>
      ) : null}
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-data text-[10px] tracking-widest text-faint">{label.toUpperCase()}</dt>
      <dd className="font-data mt-0.5 text-ink-soft">{value}</dd>
    </div>
  );
}
