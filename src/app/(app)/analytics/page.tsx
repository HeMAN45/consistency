import type { Metadata } from "next";

import { StepsChart, WakeChart, WeeklyTrendChart } from "@/components/charts";
import { Heatmap } from "@/components/heatmap";
import { StatCard } from "@/components/stat-card";
import { buildWeeklyReview, loadAnalytics } from "@/lib/analytics";
import { db } from "@/lib/db";
import { TIERS, tierFor } from "@/lib/rank";
import { requireUser } from "@/lib/session";
import { formatDayKey } from "@/lib/time";

export const metadata: Metadata = { title: "Analytics · ~/consistency" };

export default async function AnalyticsPage() {
  const user = await requireUser();
  const bundle = await loadAnalytics(user);
  const review = buildWeeklyReview(bundle, user.timezone);

  const rankHistory = await db.rankHistory.findMany({
    where: { userId: user.id },
    orderBy: { changedAt: "asc" },
    take: 20,
  });

  const currentTier = tierFor(user.rating);

  if (bundle.totalTracked === 0) {
    return (
      <div className="rise space-y-6">
        <h1 className="font-data text-2xl tracking-tight">Analytics</h1>
        <div className="card p-8">
          <p className="font-data text-sm text-ink">No tracked days yet.</p>
          <p className="mt-2 max-w-md text-sm text-muted">
            Complete a task on the dashboard and this page starts filling with your own numbers.
            Nothing here is simulated.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rise space-y-6">
      <header>
        <h1 className="font-data text-2xl tracking-tight">Analytics</h1>
        <p className="mt-1 text-sm text-muted">
          {bundle.totalTracked} tracked {bundle.totalTracked === 1 ? "day" : "days"} ·{" "}
          {bundle.perfectDays} perfect
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="CONSISTENCY"
          value={bundle.consistency}
          suffix="/ 100"
          hint={
            bundle.previousConsistency > 0
              ? `Previous 30 days: ${bundle.previousConsistency}`
              : "Last 30 days"
          }
        />
        <StatCard
          label="MOMENTUM"
          value={`${bundle.momentum.deltaPoints > 0 ? "+" : ""}${bundle.momentum.deltaPoints}%`}
          trend={bundle.momentum.direction}
          hint={`${bundle.momentum.recentPct}% vs ${bundle.momentum.previousPct}%`}
        />
        <StatCard
          label="STREAK"
          value={user.currentStreak}
          suffix={user.currentStreak === 1 ? "day" : "days"}
          hint={`Best ${user.longestStreak}`}
        />
      </div>

      <Heatmap days={bundle.heatmap} />

      <section className="card p-5">
        <p className="font-data text-[11px] tracking-widest text-muted">WHAT THE DATA SAYS</p>
        <ul className="mt-3 space-y-2">
          {bundle.insights.map((insight) => (
            <li key={insight} className="text-sm text-ink-soft">
              {insight}
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-5">
          <p className="font-data text-[11px] tracking-widest text-muted">WEEKLY COMPLETION</p>
          <div className="mt-3">
            <WeeklyTrendChart data={bundle.weeklyTrend} />
          </div>
        </section>

        <section className="card p-5">
          <p className="font-data text-[11px] tracking-widest text-muted">TODAY VS YOUR AVERAGE</p>
          {bundle.categories.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No core tasks scheduled in this window.</p>
          ) : (
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="font-data text-[10px] tracking-widest text-faint">
                  <th className="pb-2 text-left font-normal">CATEGORY</th>
                  <th className="pb-2 text-right font-normal">TODAY</th>
                  <th className="pb-2 text-right font-normal">AVG</th>
                  <th className="pb-2 w-6" />
                </tr>
              </thead>
              <tbody className="font-data">
                {bundle.categories.map((c) => {
                  const today = c.todayPct === null ? null : Math.round(c.todayPct * 100);
                  const avg = Math.round(c.pct * 100);
                  return (
                    <tr key={c.category} className="border-t border-line">
                      <td className="py-2 text-ink-soft">{c.category}</td>
                      <td className="py-2 text-right">{today === null ? "—" : `${today}%`}</td>
                      <td className="py-2 text-right text-muted">{avg}%</td>
                      <td className="py-2 text-right">
                        {today === null ? null : today > avg ? (
                          <span className="text-good">↑</span>
                        ) : today < avg ? (
                          <span className="text-bad">↓</span>
                        ) : (
                          <span className="text-faint">·</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        <section className="card p-5">
          <p className="font-data text-[11px] tracking-widest text-muted">STEPS</p>
          <div className="mt-3">
            <StepsChart data={bundle.stepsTrend} goal={user.stepGoal} />
          </div>
        </section>

        <section className="card p-5">
          <p className="font-data text-[11px] tracking-widest text-muted">WAKE TIME</p>
          <div className="mt-3">
            <WakeChart data={bundle.wakeTrend} />
          </div>
        </section>
      </div>

      <section className="card p-5">
        <p className="font-data text-[11px] tracking-widest text-muted">THIS WEEK</p>

        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <dl className="space-y-2 text-sm">
            <Row label="Consistency" value={`${review.consistency} / 100`} />
            <Row label="Perfect days" value={String(review.perfectDays)} />
            <Row
              label="Strongest"
              value={
                review.strongest
                  ? `${review.strongest.category} · ${Math.round(review.strongest.pct * 100)}%`
                  : "—"
              }
            />
            <Row
              label="Weakest"
              value={
                review.weakest
                  ? `${review.weakest.category} · ${Math.round(review.weakest.pct * 100)}%`
                  : "—"
              }
            />
            <Row
              label="Best day"
              value={
                review.bestDay
                  ? `${formatDayKey(review.bestDay.date)} · ${Math.round(review.bestDay.pct * 100)}%`
                  : "—"
              }
            />
          </dl>

          <div>
            <p className="font-data text-[11px] tracking-widest text-amber">NEXT WEEK FOCUS</p>
            <ul className="mt-2 space-y-1.5">
              {review.focus.map((line) => (
                <li key={line} className="text-sm text-ink-soft">
                  → {line}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="card p-5">
        <p className="font-data text-[11px] tracking-widest text-muted">RANK PROGRESSION</p>

        <ol className="mt-4 space-y-1.5">
          {TIERS.map((tier) => {
            const reached = user.rating >= tier.min;
            const current = tier.tier === currentTier.tier;
            return (
              <li key={tier.tier} className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 rounded-full"
                  style={{
                    background: reached ? `var(${tier.color})` : "var(--color-line-strong)",
                  }}
                />
                <span
                  className="font-data text-sm"
                  style={{ color: reached ? `var(${tier.color})` : "var(--color-faint)" }}
                >
                  {tier.label}
                </span>
                {current ? (
                  <span className="font-data text-[10px] tracking-widest text-muted">← CURRENT</span>
                ) : null}
                <span className="font-data ml-auto text-[10px] text-faint">{tier.min}</span>
              </li>
            );
          })}
        </ol>

        {rankHistory.length > 0 ? (
          <div className="mt-5 border-t border-line pt-4">
            <p className="font-data text-[11px] tracking-widest text-muted">HISTORY</p>
            <ul className="mt-2 space-y-1">
              {rankHistory.map((entry) => (
                <li key={entry.id} className="font-data text-xs text-ink-soft">
                  {entry.changedAt.toISOString().slice(0, 10)} · {entry.fromTier ?? "—"} →{" "}
                  {entry.toTier} ({entry.rating})
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-line pb-2">
      <dt className="text-muted">{label}</dt>
      <dd className="font-data text-ink-soft">{value}</dd>
    </div>
  );
}
