"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { CommandStrip } from "@/components/landing/command-strip";
import { RatingMachine, simulate } from "@/components/landing/rating-machine";
import { tierFor } from "@/lib/rank";

/**
 * The one bold move on this page: the accent colour is not a brand decision,
 * it is a consequence. Drag the slider and the hero takes the colour of the
 * rank you would actually reach — grey at 40%, blue at 85%, red at the top.
 * Amber stays reserved for actions, so the buttons never move.
 */
export function Hero() {
  const [effort, setEffort] = useState(82);

  const tier = useMemo(() => tierFor(simulate(effort / 100).rating), [effort]);

  return (
    <section
      className="relative overflow-hidden border-b border-line"
      style={{ ["--accent" as string]: `var(${tier.color})` }}
    >
      <div aria-hidden className="hairline-grid pointer-events-none absolute inset-0 opacity-60" />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px transition-colors duration-500"
        style={{ background: "var(--accent)", opacity: 0.7 }}
      />

      <div className="relative mx-auto grid max-w-6xl gap-12 px-5 pt-14 pb-16 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-16 lg:pt-20 lg:pb-24">
        <div>
          <CommandStrip />

          <h1 className="mt-8 text-[clamp(3rem,9vw,6rem)] leading-[0.9] font-semibold tracking-[-0.045em]">
            A rank
            <br />
            you can
            <br />
            <span className="transition-colors duration-500" style={{ color: "var(--accent)" }}>
              lose.
            </span>
          </h1>

          <p className="mt-8 max-w-md text-lg leading-relaxed text-ink-soft">
            You already know what to do. The problem is doing it on the days you don&apos;t feel
            like it. This keeps score honestly, and lets the number fall when you don&apos;t show
            up.
          </p>

          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              href="/register"
              className="font-data rounded-md bg-amber px-6 py-3 text-sm text-void transition-colors hover:bg-amber-soft"
            >
              Start tracking
            </Link>
            <Link
              href="/login"
              className="font-data rounded-md border border-line bg-raised px-6 py-3 text-sm text-ink-soft transition-colors hover:border-line-strong hover:text-ink"
            >
              Sign in
            </Link>
          </div>

          <p className="mt-6 text-sm text-faint">
            Drag the slider. The page takes the colour of the rank you&apos;d earn.
          </p>
        </div>

        <RatingMachine effort={effort} onEffortChange={setEffort} />
      </div>
    </section>
  );
}
