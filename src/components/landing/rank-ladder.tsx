"use client";

import { useEffect, useRef, useState } from "react";

import { TIERS } from "@/lib/rank";

/** The ladder lights up rung by rung as it enters view. */
export function RankLadder() {
  const ref = useRef<HTMLUListElement>(null);
  const [reached, setReached] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setReached(TIERS.length);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        let step = 0;
        const timer = setInterval(() => {
          step += 1;
          setReached(step);
          if (step >= TIERS.length) clearInterval(timer);
        }, 220);
      },
      { threshold: 0.3 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="px-5 py-20">
      <div className="mx-auto max-w-3xl">
        <p className="font-data text-[11px] tracking-[0.3em] text-muted">PROGRESSION</p>
        <h2 className="font-data mt-3 text-2xl tracking-tight sm:text-3xl">
          A rank you can lose
        </h2>
        <p className="mt-3 max-w-lg text-ink-soft">
          Rating moves against a 70% expectation line. Beat it and you climb, miss it and you fall.
          No streak freezes, no participation points.
        </p>

        <ul ref={ref} className="mt-8 space-y-2">
          {TIERS.map((tier, i) => {
            const lit = i < reached;
            return (
              <li
                key={tier.tier}
                className="flex items-center gap-4 transition-opacity duration-500"
                style={{ opacity: lit ? 1 : 0.25 }}
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full transition-colors duration-500"
                  style={{ background: lit ? `var(${tier.color})` : "var(--color-line-strong)" }}
                />
                <span
                  className="font-data text-sm transition-colors duration-500 sm:text-base"
                  style={{ color: lit ? `var(${tier.color})` : "var(--color-faint)" }}
                >
                  {tier.label}
                </span>
                <span className="h-px flex-1 bg-line" />
                <span className="font-data text-[11px] text-faint">{tier.min}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
