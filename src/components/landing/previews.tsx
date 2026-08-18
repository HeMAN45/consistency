"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Small, honest reproductions of the real interface, built from the same design
 * tokens as the app itself. The landing page previously described the product
 * without ever showing it, which is a hard sell for something this visual.
 *
 * Every number here is illustrative and says so. Nothing claims to be a real
 * person's data.
 */

function useInView<T extends HTMLElement>(threshold = 0.35) {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setSeen(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && setSeen(true),
      { threshold },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, seen };
}

// ------------------------------------------------------------- dashboard

const TASKS = [
  "DSA problems",
  "SQL practice",
  "Gym",
  "Pranayam",
  "Diet on track",
  "ML lecture",
];

export function DashboardPreview() {
  const { ref, seen } = useInView<HTMLDivElement>();
  const [done, setDone] = useState(0);

  useEffect(() => {
    if (!seen || done >= TASKS.length) return;
    const timer = setTimeout(() => setDone((value) => value + 1), 380);
    return () => clearTimeout(timer);
  }, [seen, done]);

  const pct = done / TASKS.length;
  const complete = done === TASKS.length;

  return (
    <div ref={ref} className="card overflow-hidden p-0">
      <div className="flex items-center gap-3 border-b border-line px-5 py-3">
        <span className="h-2 w-2 rounded-full bg-rank-expert" />
        <span className="font-data text-sm text-rank-expert">Expert</span>
        <span className="font-data text-sm text-ink-soft">1284</span>
        <span className="font-data ml-auto text-xs text-muted">27 day streak</span>
      </div>

      <div className="p-5">
        <div className="flex items-baseline justify-between">
          <p className="font-data text-[10px] tracking-widest text-muted">TODAY&apos;S BATTLE</p>
          <p className="font-data text-sm text-ink-soft">
            {done} / {TASKS.length} core
          </p>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-raised">
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-500",
                complete ? "bg-good" : "bg-amber",
              )}
              style={{ width: `${pct * 100}%` }}
            />
          </div>
          <span className="font-data w-11 text-right text-lg">{Math.round(pct * 100)}%</span>
        </div>

        {complete ? (
          <p className="font-data mt-3 text-sm text-good">Perfect day. Rating banked.</p>
        ) : null}

        <ul className="mt-4 space-y-1">
          {TASKS.map((task, index) => {
            const checked = index < done;
            return (
              <li key={task} className="flex items-center gap-3 py-1.5">
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded border transition-colors",
                    checked ? "border-amber bg-amber text-void" : "border-line-strong",
                  )}
                >
                  {checked ? (
                    <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden>
                      <path
                        d="M2 6.5l2.5 2.5L10 3"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : null}
                </span>
                <span className={cn("text-sm", checked ? "text-faint line-through" : "text-ink")}>
                  {task}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

// --------------------------------------------------------------- heatmap

/** Deterministic, so the server and client agree and the pattern looks lived-in. */
function intensity(index: number) {
  const wave = Math.sin(index * 0.7) + Math.sin(index * 0.13) * 1.4 + Math.sin(index * 0.031) * 0.8;
  const normalised = (wave + 3.2) / 6.4;
  if (index % 37 === 0 || index % 53 === 0) return 0;
  if (normalised > 0.78) return 4;
  if (normalised > 0.6) return 3;
  if (normalised > 0.42) return 2;
  if (normalised > 0.24) return 1;
  return 0;
}

const LEVELS = ["bg-raised", "bg-amber/25", "bg-amber/45", "bg-amber/70", "bg-amber"];

export function HeatmapPreview() {
  const { ref, seen } = useInView<HTMLDivElement>(0.25);
  const columns = 40;

  return (
    <div ref={ref} className="card p-5">
      <div className="flex items-baseline justify-between">
        <p className="font-data text-[10px] tracking-widest text-muted">THE YEAR SO FAR</p>
        <p className="font-data text-[10px] text-faint">ILLUSTRATIVE</p>
      </div>

      <div className="mt-4 overflow-hidden">
        <div className="flex gap-[3px]">
          {Array.from({ length: columns }).map((_, column) => (
            <div key={column} className="flex flex-col gap-[3px]">
              {Array.from({ length: 7 }).map((__, row) => {
                const index = column * 7 + row;
                const level = intensity(index);
                return (
                  <span
                    key={row}
                    className={cn("h-3 w-3 rounded-[2px] transition-opacity duration-500", LEVELS[level])}
                    style={{
                      opacity: seen ? 1 : 0,
                      transitionDelay: `${column * 18}ms`,
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-1.5">
        <span className="font-data text-[10px] text-faint">LESS</span>
        {LEVELS.map((level, index) => (
          <span key={index} className={cn("h-2.5 w-2.5 rounded-[2px]", level)} />
        ))}
        <span className="font-data text-[10px] text-faint">MORE</span>
      </div>
    </div>
  );
}

// -------------------------------------------------------------- problems

const PROBLEMS: [string, string, string, boolean][] = [
  ["Two Sum", "LEETCODE", "EASY", true],
  ["Longest Substring", "LEETCODE", "MEDIUM", true],
  ["Codeforces 158B", "CODEFORCES", "", true],
  ["Word Ladder", "LEETCODE", "HARD", false],
  ["Merge Intervals", "LEETCODE", "MEDIUM", false],
];

export function ProblemsPreview() {
  return (
    <div className="card p-5">
      <div className="flex items-baseline justify-between">
        <p className="font-data text-[10px] tracking-widest text-muted">PROBLEMS</p>
        <p className="font-data text-[10px] text-faint">3 / 5 SOLVED</p>
      </div>

      <ul className="mt-4 space-y-1">
        {PROBLEMS.map(([name, platform, difficulty, solved]) => (
          <li key={name} className="flex items-center gap-3 py-1.5">
            <span
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded border",
                solved ? "border-good bg-good/20 text-good" : "border-line-strong",
              )}
            >
              {solved ? (
                <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden>
                  <path
                    d="M2 6.5l2.5 2.5L10 3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : null}
            </span>

            <span className="min-w-0 flex-1">
              <span className={cn("block truncate text-sm", solved ? "text-faint" : "text-ink")}>
                {name}
              </span>
              <span className="font-data text-[10px] tracking-widest text-faint">
                {platform}
                {difficulty ? ` · ${difficulty}` : ""}
              </span>
            </span>

            <span className="font-data shrink-0 text-[10px] tracking-widest text-amber">OPEN</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ----------------------------------------------------------------- focus

export function FocusPreview() {
  const { ref, seen } = useInView<HTMLDivElement>();
  const [seconds, setSeconds] = useState(5400);

  useEffect(() => {
    if (!seen) return;
    const timer = setInterval(() => setSeconds((value) => (value > 0 ? value - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, [seen]);

  const minutes = String(Math.floor(seconds / 60)).padStart(2, "0");
  const rest = String(seconds % 60).padStart(2, "0");
  const progress = 1 - seconds / 5400;

  return (
    <div ref={ref} className="card p-8 text-center">
      <p className="font-data text-[10px] tracking-widest text-muted">DSA · 90 MIN</p>

      <p className="font-data mt-6 text-5xl leading-none tracking-tight tabular-nums sm:text-6xl">
        {minutes}:{rest}
      </p>

      <div className="mx-auto mt-7 h-1 w-full max-w-[220px] overflow-hidden rounded-full bg-raised">
        <div
          className="h-full bg-amber transition-[width] duration-1000"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      <p className="mt-6 text-xs text-faint">
        Ambient sound, flip clock and fullscreen, all optional.
      </p>
    </div>
  );
}
