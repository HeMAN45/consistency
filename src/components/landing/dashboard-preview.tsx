"use client";

import { useEffect, useRef, useState } from "react";

const TASKS = [
  "Pranayam",
  "DSA lecture",
  "DSA problems",
  "SQL practice",
  "Gym",
  "Diet on track",
];

/** Fills itself once, when scrolled into view — the loop the product is built on. */
export function DashboardPreview() {
  const ref = useRef<HTMLDivElement>(null);
  const [done, setDone] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setDone(TASKS.length);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setStarted(true);
      },
      { threshold: 0.4 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!started || done >= TASKS.length) return;
    const timer = setTimeout(() => setDone((d) => d + 1), 420);
    return () => clearTimeout(timer);
  }, [started, done]);

  const pct = done / TASKS.length;
  const complete = done === TASKS.length;

  return (
    <section ref={ref} className="px-5 py-20">
      <div className="mx-auto max-w-3xl">
        <p className="font-data text-[11px] tracking-[0.3em] text-muted">THE DAILY LOOP</p>
        <h2 className="font-data mt-3 text-2xl tracking-tight sm:text-3xl">
          Plan. Do. Log. Measure.
        </h2>
        <p className="mt-3 max-w-lg text-ink-soft">
          One screen answers one question: did I actually do the work today?
        </p>

        <div className="card mt-8 p-5 sm:p-6">
          <div className="flex items-baseline justify-between">
            <p className="font-data text-[11px] tracking-widest text-muted">TODAY&apos;S BATTLE</p>
            <p className="font-data text-sm text-ink-soft">
              {done} / {TASKS.length} core
            </p>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-raised">
              <div
                className={`h-full rounded-full transition-[width] duration-500 ${
                  complete ? "bg-good" : "bg-amber"
                }`}
                style={{ width: `${pct * 100}%` }}
              />
            </div>
            <span className="font-data w-12 text-right text-lg">{Math.round(pct * 100)}%</span>
          </div>

          {complete ? (
            <p className="font-data mt-3 text-sm text-good">Perfect day. Rating banked.</p>
          ) : null}

          <ul className="mt-5 space-y-1">
            {TASKS.map((task, i) => {
              const checked = i < done;
              return (
                <li key={task} className="flex items-center gap-3 py-1.5">
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded border text-void transition-colors ${
                      checked ? "border-amber bg-amber" : "border-line-strong"
                    }`}
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
                  <span className={`text-sm ${checked ? "text-faint line-through" : "text-ink"}`}>
                    {task}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
