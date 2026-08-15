"use client";

import { useMemo } from "react";

import { applyRatingDelta, ratingDeltaForDay, TIERS, tierFor } from "@/lib/rank";

/**
 * Controlled instrument. The parent owns `effort` so the whole hero can take
 * its accent colour from the tier you'd land at — drag the slider and the page
 * changes colour with you.
 *
 * Nothing here is a mock: `ratingDeltaForDay` is the same function the app runs
 * every night.
 */

const DAYS = 90;
const MAX_PLOT_RATING = 2400;

/** Deterministic wobble, so server and client render identically. */
function dayCompletion(base: number, index: number) {
  const wobble = Math.sin(index * 1.7) * 0.14 + Math.sin(index * 0.41) * 0.07;
  return Math.max(0, Math.min(1, base + wobble * (1 - Math.abs(base - 0.5) * 1.2)));
}

export function simulate(base: number) {
  let rating = 0;
  let streak = 0;
  let perfect = 0;
  const series: number[] = [];

  for (let day = 0; day < DAYS; day++) {
    const completionPct = dayCompletion(base, day);
    const perfectDay = completionPct > 0.995;

    rating = applyRatingDelta(
      rating,
      ratingDeltaForDay({
        completionPct,
        perfectDay,
        stepGoalMet: completionPct > 0.7,
        wakeGoalMet: completionPct > 0.8,
        streakBefore: streak,
        hadCoreTasks: true,
      }),
    );

    streak = perfectDay ? streak + 1 : 0;
    if (perfectDay) perfect += 1;
    series.push(rating);
  }

  return { rating, series, perfect, streak };
}

export function RatingMachine({
  effort,
  onEffortChange,
}: {
  effort: number;
  onEffortChange: (value: number) => void;
}) {
  const { rating, series, perfect } = useMemo(() => simulate(effort / 100), [effort]);
  const tier = tierFor(rating);

  const path = useMemo(() => {
    const step = 600 / (series.length - 1);
    return series
      .map((value, i) => {
        const x = (i * step).toFixed(1);
        const y = (200 - Math.min(1, value / MAX_PLOT_RATING) * 200).toFixed(1);
        return `${i === 0 ? "M" : "L"}${x},${y}`;
      })
      .join(" ");
  }, [series]);

  return (
    <div className="card overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <p className="font-data text-[10px] tracking-[0.28em] text-faint">90-DAY SIMULATION</p>
        <p className="font-data text-[10px] tracking-[0.28em] text-faint">LIVE FORMULA</p>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4 px-5 pt-5">
        <div>
          <p className="font-data text-[10px] tracking-[0.28em] text-muted">YOU&apos;D BE</p>
          <p
            className="mt-1.5 text-3xl leading-none font-semibold tracking-[-0.03em] sm:text-4xl"
            style={{ color: "var(--accent)" }}
          >
            {tier.label}
          </p>
        </div>

        <div className="text-right">
          <p className="font-data text-[10px] tracking-[0.28em] text-muted">RATING</p>
          <p className="font-data mt-1.5 text-3xl leading-none tabular-nums sm:text-4xl">
            {rating}
          </p>
        </div>
      </div>

      <div className="relative mt-5">
        <svg viewBox="0 0 600 200" preserveAspectRatio="none" className="h-40 w-full sm:h-52">
          {TIERS.filter((t) => t.min > 0 && t.min <= MAX_PLOT_RATING).map((t) => {
            const y = 200 - (t.min / MAX_PLOT_RATING) * 200;
            return (
              <line
                key={t.tier}
                x1="0"
                x2="600"
                y1={y}
                y2={y}
                stroke={`var(${t.color})`}
                strokeWidth="0.5"
                strokeDasharray="2 6"
                opacity={rating >= t.min ? 0.55 : 0.22}
              />
            );
          })}

          <path d={`${path} L600,200 L0,200 Z`} fill="var(--accent)" opacity="0.14" />
          <path
            d={path}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
          />
        </svg>

        <ul className="pointer-events-none absolute inset-y-0 right-2 hidden flex-col justify-between py-1 sm:flex">
          {[...TIERS]
            .reverse()
            .filter((t) => t.min > 0 && t.min <= MAX_PLOT_RATING)
            .map((t) => (
              <li
                key={t.tier}
                className="font-data text-[9px] tracking-[0.2em]"
                style={{ color: `var(${t.color})`, opacity: rating >= t.min ? 0.95 : 0.28 }}
              >
                {t.label.toUpperCase()}
              </li>
            ))}
        </ul>
      </div>

      <div className="border-t border-line px-5 py-5">
        <label htmlFor="effort" className="flex items-baseline justify-between">
          <span className="font-data text-[10px] tracking-[0.28em] text-muted">
            CORE TASKS FINISHED
          </span>
          <span className="font-data text-sm tabular-nums text-ink-soft">{effort}%</span>
        </label>

        <input
          id="effort"
          type="range"
          min={0}
          max={100}
          value={effort}
          onChange={(event) => onEffortChange(Number(event.target.value))}
          className="mt-3 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-raised outline-none [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-[var(--accent)] [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--accent)]"
        />

        <p className="mt-4 text-sm text-muted">
          {effort >= 95
            ? `${perfect} perfect days. Nothing left to catch up on.`
            : effort >= 70
              ? `${perfect} perfect days. Above the line, so the rating climbs.`
              : effort >= 50
                ? "Below the line. Effort, with no rank to show for it."
                : "The floor. This is what putting it off actually costs."}
        </p>
      </div>
    </div>
  );
}
