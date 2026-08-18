import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Hero } from "@/components/landing/hero";
import {
  DashboardPreview,
  FocusPreview,
  HeatmapPreview,
  ProblemsPreview,
} from "@/components/landing/previews";
import { SyncPreview } from "@/components/landing/sync-preview";
import { db } from "@/lib/db";
import { BACKFILL_DAYS } from "@/lib/backfill";
import { RATING_RULES, TIERS, XP_RULES } from "@/lib/rank";
import { REST_DAYS_PER_MONTH } from "@/lib/rest-days";
import { GROUP_STREAK_THRESHOLD } from "@/lib/sync-rules";
import { getCurrentUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "~/consistency — a personal discipline operating system",
  description:
    "Track DSA, SQL, ML, gym and sleep in one place. A Codeforces-style rank you can lose, courses that become daily tasks, analytics built only from what you logged, and shared goals that never touch your own progress.",
};

export const dynamic = "force-dynamic";

/** Copy on one side, working interface on the other, alternating down the page. */
function Feature({
  eyebrow,
  title,
  body,
  points,
  visual,
  flip = false,
}: {
  eyebrow: string;
  title: React.ReactNode;
  body: string;
  points: string[];
  visual: React.ReactNode;
  flip?: boolean;
}) {
  return (
    <section className="border-b border-line px-5 py-16 sm:py-20">
      <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <div className={cn(flip && "lg:order-2")}>
          <p className="font-data text-[10px] tracking-[0.32em] text-muted">{eyebrow}</p>

          <h2 className="mt-3 text-[clamp(1.75rem,4.5vw,2.75rem)] leading-[1.03] font-semibold tracking-[-0.035em]">
            {title}
          </h2>

          <p className="mt-4 max-w-md leading-relaxed text-ink-soft">{body}</p>

          <ul className="mt-6 space-y-2.5">
            {points.map((point) => (
              <li key={point} className="flex gap-3 text-sm text-muted">
                <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-amber" />
                {point}
              </li>
            ))}
          </ul>
        </div>

        <div className={cn(flip && "lg:order-1")}>{visual}</div>
      </div>
    </section>
  );
}

export default async function LandingPage() {
  try {
    if (await getCurrentUser()) redirect("/dashboard");
  } catch (error) {
    // redirect() throws by design and must bubble; a database outage must not.
    if (error && typeof error === "object" && "digest" in error) throw error;
  }

  let quote: { text: string; author: string | null } | null = null;
  try {
    const quotes = await db.quote.findMany({ select: { text: true, author: true } });
    quote = quotes.length ? quotes[Math.floor(Math.random() * quotes.length)] : null;
  } catch {
    quote = null;
  }

  return (
    <main className="min-h-dvh">
      <Hero />

      {/* A thin band on one line, no wrapping, no dangling separators. */}
      <section className="border-b border-line px-5 py-3.5">
        <div className="mx-auto max-w-6xl overflow-x-auto">
          <ul className="font-data flex w-max items-center gap-6 text-[10px] tracking-[0.28em] whitespace-nowrap text-faint">
            <li>{TIERS.length} TIERS</li>
            <li aria-hidden>·</li>
            <li>±{RATING_RULES.ceiling} RATING A DAY</li>
            <li aria-hidden>·</li>
            <li>{Math.round(RATING_RULES.expectation * 100)}% LINE</li>
            <li aria-hidden>·</li>
            <li>{BACKFILL_DAYS}-DAY BACKFILL</li>
            <li aria-hidden>·</li>
            <li>{REST_DAYS_PER_MONTH} REST DAYS</li>
            <li aria-hidden>·</li>
            <li>NO STREAK FREEZES</li>
          </ul>
        </div>
      </section>

      <Feature
        eyebrow="EVERY DAY"
        title={
          <>
            One screen.
            <br />
            One question.
          </>
        }
        body="Did I actually do the work today? Core tasks decide the day and set your rating. Bonus work earns XP and rescues nothing."
        points={[
          "Steps, wake time and a note, logged in seconds",
          "Tick from the dashboard, or from your phone with no signal",
          "Miss a day and name why. It changes no number, only your pattern",
        ]}
        visual={<DashboardPreview />}
      />

      <Feature
        eyebrow="PRACTICE"
        title={
          <>
            Paste the links.
            <br />
            Solve them.
          </>
        }
        body="LeetCode, Codeforces, anywhere. Drop a batch of URLs and each becomes a task with a click-through link. Solving one moves your rating like anything else."
        points={[
          "Platform and title read from the URL, nothing to type",
          "Optional difficulty and topic tags, or none at all",
          "Analytics by platform, difficulty and topic",
        ]}
        visual={<ProblemsPreview />}
        flip
      />

      <Feature
        eyebrow="COURSES"
        title={
          <>
            A playlist,
            <br />
            turned into a plan.
          </>
        }
        body="Import a YouTube course, choose a pace, and its videos become dated tasks. The embedded player counts only video actually played, at any speed."
        points={[
          "See the finish date before you commit to a pace",
          "Fall behind and the date moves, which is the point",
          "Already halfway through? Start from video 41 without faking history",
        ]}
        visual={<FocusPreview />}
      />

      <Feature
        eyebrow="EVIDENCE"
        title={<>A year you can look at.</>}
        body="Built only from what you logged. Momentum, per-category averages, personal records and a weekly review that names your weakest day."
        points={[
          "Click any day for its tasks, steps, wake time and note",
          "Rest days marked as planned, not as failures",
          "Too little history? It says so instead of inventing a trend",
        ]}
        visual={<HeatmapPreview />}
        flip
      />

      {/* ----------------------------------------------------------- quote */}
      {quote ? (
        <section className="border-b border-line px-5 py-20 sm:py-24">
          <figure className="mx-auto max-w-4xl">
            <span aria-hidden className="block h-px w-16 bg-amber" />
            <blockquote className="mt-8 text-[clamp(1.6rem,4.5vw,3rem)] leading-[1.08] font-semibold tracking-[-0.035em] text-ink">
              {quote.text}
            </blockquote>
            {quote.author ? (
              <figcaption className="font-data mt-6 text-[10px] tracking-[0.32em] text-amber">
                {quote.author.toUpperCase()}
              </figcaption>
            ) : null}
          </figure>
        </section>
      ) : null}

      <Feature
        eyebrow="SYNC"
        title={
          <>
            Let&apos;s grow
            <br />
            <span className="text-amber">together.</span>
          </>
        }
        body="Doing this alone is why it stops in week three. A SYNC is one goal, one room, and everyone's progress in the open, including the days nobody showed up."
        points={[
          "Aim for 100 days while someone else aims for 60",
          `${Math.round(GROUP_STREAK_THRESHOLD * 100)}% of the room clears the day or the group streak breaks`,
          "The room shows rank and goal progress. Your tasks stay private",
          "Shared work lives in its own table and can never inflate your rank",
        ]}
        visual={<SyncPreview />}
      />

      {/* -------------------------------------------------------- refusals */}
      <section className="border-b border-line px-5 py-20">
        <div className="mx-auto max-w-6xl">
          <p className="font-data text-[10px] tracking-[0.32em] text-muted">WHERE THE LINES ARE</p>

          <h2 className="mt-3 max-w-2xl text-[clamp(1.75rem,5vw,2.75rem)] leading-[1.03] font-semibold tracking-[-0.035em]">
            The refusals matter more than the features.
          </h2>

          <dl className="mt-10 grid gap-x-10 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              [
                "No streak freezes",
                "Plan a rest day in advance. You cannot buy back a day you already lost.",
              ],
              [
                "No unlimited backfill",
                "Seven days. Beyond that a streak stops being a record and becomes a story.",
              ],
              [
                "No borrowed progress",
                "Group work lives in its own table. Nobody else's effort can inflate your rank.",
              ],
              [
                "No invented insights",
                "With too little history it says so, rather than drawing a trend through two points.",
              ],
              [
                "No fake integrations",
                "The calendar boundary exists and is empty. Nothing pretends to be synced.",
              ],
              [
                "No hidden score",
                "Every constant is published below, read from the code at build time.",
              ],
            ].map(([title, detail]) => (
              <div key={title}>
                <dt className="font-data text-sm text-amber">{title}</dt>
                <dd className="mt-1.5 text-sm leading-relaxed text-ink-soft">{detail}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ------------------------------------------------------------ math */}
      <section className="border-b border-line px-5 py-20">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1fr_1.15fr] lg:gap-16">
          <div>
            <p className="font-data text-[10px] tracking-[0.32em] text-muted">THE MATH, IN FULL</p>
            <h2 className="mt-3 text-[clamp(1.75rem,5vw,2.75rem)] leading-[1.03] font-semibold tracking-[-0.035em]">
              No hidden score.
            </h2>
            <p className="mt-4 max-w-sm leading-relaxed text-ink-soft">
              You should be able to explain your own day without trusting us about it.
            </p>
          </div>

          <dl className="font-data text-sm">
            {[
              ["Hold the line", `${Math.round(RATING_RULES.expectation * 100)}% of core tasks`],
              ["Best possible day", `+${RATING_RULES.ceiling} before bonuses`],
              ["Worst possible day", `${RATING_RULES.floor}`],
              ["Perfect day", `+${RATING_RULES.perfectDay} rating · +${XP_RULES.perfectDay} XP`],
              ["Step goal met", `+${RATING_RULES.stepGoal} rating`],
              ["Wake goal met", `+${RATING_RULES.wakeGoal} rating`],
              ["Long streak", `up to +${RATING_RULES.maxStreakBonus} per day`],
              ["Bad day", "bonuses do not apply"],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex items-baseline justify-between gap-6 border-b border-line py-3"
              >
                <dt className="text-muted">{label}</dt>
                <dd className="text-right text-ink-soft">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ------------------------------------------------------------- cta */}
      <section className="px-5 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-[clamp(1.9rem,5.5vw,3.4rem)] leading-[1.02] font-semibold tracking-[-0.04em]">
            Shared direction.
            <br />
            <span className="text-amber">Individual accountability.</span>
          </h2>

          <p className="mt-5 max-w-md text-lg leading-relaxed text-ink-soft">
            Start alone tonight. Bring people in when you want the pressure.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/register"
              className="font-data rounded-md bg-amber px-6 py-3 text-sm text-void transition-colors hover:bg-amber-soft"
            >
              Create your account
            </Link>
            <Link
              href="/login"
              className="font-data rounded-md border border-line bg-raised px-6 py-3 text-sm text-ink-soft transition-colors hover:border-line-strong hover:text-ink"
            >
              Sign in
            </Link>
          </div>

          <p className="mt-5 text-sm text-faint">
            Installs as an app, logs offline, works in light or dark.
          </p>
        </div>
      </section>

      <footer className="border-t border-line px-5 py-8">
        <p className="font-data mx-auto max-w-6xl text-[10px] tracking-[0.28em] text-faint">
          ~/CONSISTENCY
        </p>
      </footer>
    </main>
  );
}
