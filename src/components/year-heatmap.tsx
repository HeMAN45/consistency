"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { YearDay, YearHeatmap } from "@/lib/analytics";
import { cn } from "@/lib/utils";

const CELL = 13; // px, fixed by the grid template so cells cannot collapse
const GAP = 3;

const WEEKDAYS = ["Mon", "", "Wed", "", "Fri", "", "Sun"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function level(day: YearDay) {
  if (!day.hasData) return 0;
  if (day.completionPct >= 1) return 4;
  if (day.completionPct >= 0.75) return 3;
  if (day.completionPct >= 0.5) return 2;
  if (day.completionPct > 0) return 1;
  return 0;
}

const LEVEL_CLASS = ["bg-raised", "bg-amber/25", "bg-amber/45", "bg-amber/70", "bg-amber"];

/** Monday-first weekday index for a yyyy-MM-dd key. */
function weekdayIndex(key: string) {
  const day = new Date(`${key}T00:00:00.000Z`).getUTCDay(); // 0 = Sunday
  return (day + 6) % 7;
}

export function YearHeatmapGrid({ data }: { data: YearHeatmap }) {
  const router = useRouter();
  const [selected, setSelected] = useState<YearDay | null>(null);

  /**
   * Column-major, seven rows per column, padded at both ends so every column
   * is a real calendar week. The grid uses `grid-flow-col` with fixed tracks,
   * so cells keep their size no matter how narrow the container gets.
   */
  const { cells, columnCount, monthLabels } = useMemo(() => {
    const padded: (YearDay | null)[] = [];

    const first = data.days[0];
    if (first) for (let i = 0; i < weekdayIndex(first.date); i++) padded.push(null);

    padded.push(...data.days);
    while (padded.length % 7 !== 0) padded.push(null);

    const count = padded.length / 7;

    // A month gets its label above the first column containing its 1st.
    const labels: (string | null)[] = Array.from({ length: count }, () => null);
    for (let column = 0; column < count; column++) {
      const week = padded.slice(column * 7, column * 7 + 7);
      const start = week.find((day) => day && day.date.endsWith("-01"));
      if (start) labels[column] = MONTHS[Number(start.date.slice(5, 7)) - 1];
    }

    return { cells: padded, columnCount: count, monthLabels: labels };
  }, [data.days]);

  const columnTemplate = `repeat(${columnCount}, ${CELL}px)`;

  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="font-data text-[11px] tracking-widest text-muted">
            {data.totals.tracked} DAYS TRACKED IN {data.year}
          </p>
          <p className="mt-1 text-xs text-faint">
            {data.totals.perfect} perfect · {data.totals.rest} rest · {data.totals.averagePct}%
            average
          </p>
        </div>

        <div className="flex flex-wrap gap-1">
          {data.availableYears.map((year) => (
            <button
              key={year}
              type="button"
              onClick={() => router.push(`/analytics?year=${year}`)}
              aria-current={year === data.year ? "true" : undefined}
              className={cn(
                "font-data rounded-md px-2.5 py-1 text-xs tabular-nums transition-colors",
                year === data.year ? "bg-raised text-amber" : "text-muted hover:text-ink",
              )}
            >
              {year}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 overflow-x-auto pb-2">
        <div className="flex gap-2" style={{ width: "max-content" }}>
          <div
            className="flex shrink-0 flex-col"
            style={{ gap: GAP, paddingTop: CELL + GAP + 2 }}
            aria-hidden
          >
            {WEEKDAYS.map((label, index) => (
              <span
                key={index}
                className="font-data flex items-center text-[9px] leading-none text-faint"
                style={{ height: CELL }}
              >
                {label}
              </span>
            ))}
          </div>

          <div className="shrink-0">
            <div
              className="grid"
              style={{ gridTemplateColumns: columnTemplate, gap: GAP, marginBottom: 2 }}
              aria-hidden
            >
              {monthLabels.map((label, index) => (
                <span
                  key={index}
                  className="font-data text-[9px] leading-none text-faint"
                  style={{ height: CELL, whiteSpace: "nowrap" }}
                >
                  {label ?? ""}
                </span>
              ))}
            </div>

            <div
              className="grid grid-flow-col"
              style={{
                gridTemplateColumns: columnTemplate,
                gridTemplateRows: `repeat(7, ${CELL}px)`,
                gap: GAP,
              }}
            >
              {cells.map((day, index) => {
                if (!day) {
                  return (
                    <span
                      key={`pad-${index}`}
                      className="block shrink-0"
                      style={{ width: CELL, height: CELL }}
                    />
                  );
                }

                if (day.inFuture) {
                  return (
                    <span
                      key={day.date}
                      className="block shrink-0 rounded-[2px] border border-line"
                      style={{ width: CELL, height: CELL }}
                      title={day.date}
                    />
                  );
                }

                const active = selected?.date === day.date;

                return (
                  <button
                    key={day.date}
                    type="button"
                    onClick={() => setSelected(active ? null : day)}
                    title={`${day.date} · ${Math.round(day.completionPct * 100)}%${
                      day.restDay ? " · rest day" : ""
                    }`}
                    aria-label={`${day.date}, ${Math.round(day.completionPct * 100)} percent`}
                    style={{ width: CELL, height: CELL }}
                    className={cn(
                      "block shrink-0 rounded-[2px] p-0",
                      day.restDay ? "bg-line-strong" : LEVEL_CLASS[level(day)],
                      active && "ring-2 ring-ink",
                    )}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
        <span className="flex items-center gap-1.5">
          <span className="font-data text-[10px] text-faint">LESS</span>
          {LEVEL_CLASS.map((cls, index) => (
            <span
              key={index}
              className={cn("rounded-[2px]", cls)}
              style={{ height: 10, width: 10 }}
            />
          ))}
          <span className="font-data text-[10px] text-faint">MORE</span>
        </span>

        <span className="flex items-center gap-1.5">
          <span className="rounded-[2px] bg-line-strong" style={{ height: 10, width: 10 }} />
          <span className="font-data text-[10px] text-faint">REST DAY</span>
        </span>

        <span className="flex items-center gap-1.5">
          <span className="rounded-[2px] border border-line" style={{ height: 10, width: 10 }} />
          <span className="font-data text-[10px] text-faint">TO COME</span>
        </span>
      </div>

      {selected ? (
        <div className="mt-5 border-t border-line pt-4">
          <p className="font-data text-sm text-ink">{selected.date}</p>

          {selected.restDay ? (
            <p className="mt-2 text-sm text-muted">Declared rest day. Nothing was counted.</p>
          ) : selected.hasData ? (
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
              <Detail label="Completion" value={`${Math.round(selected.completionPct * 100)}%`} />
              <Detail
                label="Core tasks"
                value={`${selected.coreCompleted} / ${selected.coreTotal}`}
              />
              <Detail
                label="Steps"
                value={selected.steps === null ? "—" : selected.steps.toLocaleString("en-IN")}
              />
              <Detail label="Wake" value={selected.wakeTime ?? "—"} />
            </dl>
          ) : (
            <p className="mt-2 text-sm text-muted">Nothing scheduled or logged that day.</p>
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
