"use client";

import { useEffect, useRef, useState } from "react";

import { tierFor } from "@/lib/rank";

/**
 * The social argument, shown rather than claimed: one goal, three people,
 * three different numbers — and one of them isn't even aiming at the same
 * target. Members are identified by rank, not by invented names.
 */
const MEMBERS = [
  { label: "You", rating: 1284, progress: 37, target: 100, you: true },
  { label: null, rating: 620, progress: 24, target: 100, you: false },
  { label: null, rating: 1710, progress: 41, target: 60, you: false },
];

export function SyncPreview() {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && setShown(true),
      { threshold: 0.35 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="card p-5 sm:p-6">
      <div className="flex items-baseline justify-between">
        <p className="font-data text-[10px] tracking-[0.28em] text-amber">SYNC ROOM</p>
        <p className="font-data text-[10px] tracking-[0.28em] text-faint">3 MEMBERS</p>
      </div>

      <p className="mt-4 text-xl font-semibold tracking-[-0.02em]">100 Days of DSA</p>
      <p className="font-data mt-1 text-[11px] tracking-[0.2em] text-faint">SHARED GOAL</p>

      <ul className="mt-6 space-y-5">
        {MEMBERS.map((member, i) => {
          const tier = tierFor(member.rating);
          const pct = Math.min(1, member.progress / member.target);

          return (
            <li key={i}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="flex items-baseline gap-2">
                  <span
                    aria-hidden
                    className="h-1.5 w-1.5 shrink-0 translate-y-[-2px] rounded-full"
                    style={{ background: `var(${tier.color})` }}
                  />
                  {member.you ? (
                    <span className="text-sm text-amber">You</span>
                  ) : (
                    <span className="font-data text-xs" style={{ color: `var(${tier.color})` }}>
                      {tier.label}
                    </span>
                  )}
                </span>

                <span className="font-data text-sm tabular-nums text-muted">
                  {member.progress} / {member.target}
                </span>
              </div>

              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-raised">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: shown ? `${pct * 100}%` : "0%",
                    background: member.you ? "var(--color-amber)" : `var(${tier.color})`,
                    opacity: member.you ? 1 : 0.55,
                    transition: `width 900ms cubic-bezier(0.22,1,0.36,1) ${i * 140}ms`,
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-7 border-t border-line pt-4">
        <p className="font-data text-[10px] tracking-[0.28em] text-muted">TODAY</p>
        <p className="mt-2 text-sm text-ink-soft">Solve 2 problems</p>

        <div className="mt-3 flex gap-2">
          {[true, true, false].map((done, i) => (
            <span
              key={i}
              className={`font-data flex h-7 flex-1 items-center justify-center rounded border text-xs ${
                done ? "border-good/40 bg-good/10 text-good" : "border-line text-faint"
              }`}
            >
              {done ? "done" : "not yet"}
            </span>
          ))}
        </div>

        <p className="mt-3 text-xs text-faint">Three rows. Each person ticks only their own.</p>
      </div>
    </div>
  );
}
