import type { Metadata } from "next";
import Link from "next/link";

import { ComebackBanner } from "@/components/comeback-banner";
import { BehindSchedule } from "@/components/behind-schedule";
import { GapsCard, type Gap } from "@/components/gaps-card";
import { SharedToday } from "@/components/shared-today";
import { DailyBattle } from "@/components/daily-battle";
import { MetricsForm } from "@/components/metrics-form";
import { RankBadge } from "@/components/rank-badge";
import { StatCard } from "@/components/stat-card";
import { db } from "@/lib/db";
import { consistencyScore, momentum } from "@/lib/rank";
import { comebackState } from "@/lib/progression";
import { sharedTasksForToday } from "@/lib/sync";
import { watchSummary } from "@/lib/watch-progress";
import { requireUser } from "@/lib/session";
import { tasksForDay } from "@/lib/tasks";
import { dayKeyToDate, formatDayKey, shiftDayKey, todayKey } from "@/lib/time";

export const metadata: Metadata = { title: "Dashboard · ~/consistency" };

export default async function DashboardPage() {
  const user = await requireUser();
  const today = todayKey(user.timezone);

  const [tasks, metric, snapshots, quotes, comeback, recentMetrics, rests, playlists, sharedToday] =
    await Promise.all([
    tasksForDay(user.id, today, user.timezone),
    db.dailyMetric.findUnique({
      where: { userId_date: { userId: user.id, date: dayKeyToDate(today) } },
    }),
    db.dailySnapshot.findMany({
      where: { userId: user.id, date: { gte: dayKeyToDate(shiftDayKey(today, -29)) } },
      orderBy: { date: "asc" },
    }),
    db.quote.findMany({ select: { text: true, author: true } }),
    comebackState(user.id, user.timezone),
    db.dailyMetric.findMany({
      where: { userId: user.id, date: { gte: dayKeyToDate(shiftDayKey(today, -7)) } },
      select: { date: true, missReason: true },
    }),
    db.restDay.findMany({
      where: { userId: user.id, date: { gte: dayKeyToDate(shiftDayKey(today, -7)) } },
      select: { date: true },
    }),
    watchSummary(user.id, user.timezone),
    sharedTasksForToday(user.id, user.timezone),
  ]);

  // Incomplete days inside the backfill window, excluding today and any day
  // that was declared a rest day.
  const reasonByDay = new Map(
    recentMetrics.map((m) => [m.date.toISOString().slice(0, 10), m.missReason]),
  );
  const restKeys = new Set(rests.map((r) => r.date.toISOString().slice(0, 10)));

  const gaps: Gap[] = snapshots
    .map((s) => ({ ...s, key: s.date.toISOString().slice(0, 10) }))
    .filter(
      (s) =>
        s.key < today &&
        s.key >= shiftDayKey(today, -7) &&
        s.coreTotal > 0 &&
        !s.perfectDay &&
        !restKeys.has(s.key),
    )
    .map((s) => ({
      date: s.key,
      completionPct: s.completionPct,
      coreCompleted: s.coreCompleted,
      coreTotal: s.coreTotal,
      reason: reasonByDay.get(s.key) ?? null,
    }));

  const scoreInputs = snapshots.map((s) => ({
    completionPct: s.completionPct,
    stepGoalMet: s.stepGoalMet,
    wakeGoalMet: s.wakeGoalMet,
    hadCoreTasks: s.coreTotal > 0,
  }));

  // One quote per day, stable within the day and different tomorrow — a quote
  // that changes on every refresh is noise on a screen you open constantly.
  const dayIndex = Math.floor(dayKeyToDate(today).getTime() / 86_400_000);
  const quote = quotes.length ? quotes[dayIndex % quotes.length] : null;

  const consistency = consistencyScore(scoreInputs, user.currentStreak);
  const trend = momentum(scoreInputs);
  const tracked = scoreInputs.filter((s) => s.hadCoreTasks).length;

  return (
    <div className="rise space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-data text-[11px] tracking-widest text-muted">
            {formatDayKey(today, "EEE, d MMM").toUpperCase()} · {user.timezone}
          </p>
          <h1 className="font-data mt-1 text-2xl tracking-tight">{user.displayName}</h1>
        </div>
        <div className="flex gap-4">
          <Link href="/achievements" className="font-data text-xs text-muted hover:text-ink">
            Achievements
          </Link>
          <Link href="/analytics" className="font-data text-xs text-amber hover:text-amber-soft">
            Full analytics →
          </Link>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <RankBadge rating={user.rating} variant="hero" className="lg:col-span-2" />

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-1">
          <StatCard
            label="STREAK"
            value={user.currentStreak}
            suffix={user.currentStreak === 1 ? "day" : "days"}
            hint={`Best ${user.longestStreak}`}
          />
          <StatCard label="XP" value={user.xp.toLocaleString("en-IN")} hint="Lifetime effort" />
        </div>
      </div>

      {comeback ? <ComebackBanner state={comeback} /> : null}

      <BehindSchedule playlists={playlists} />

      <DailyBattle
        dateKey={today}
        tasks={tasks.map((t) => ({
          id: t.id,
          name: t.name,
          category: t.category,
          customLabel: t.customLabel,
          isCore: t.isCore,
          completed: t.completed,
          youtubeVideoId: t.youtubeVideoId,
          linkUrl: t.linkUrl,
        }))}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label="CONSISTENCY"
          value={consistency}
          suffix="/ 100"
          hint={tracked > 0 ? `Across ${tracked} tracked days` : "Log a day to start scoring"}
        />
        <StatCard
          label="MOMENTUM"
          value={`${trend.deltaPoints > 0 ? "+" : ""}${trend.deltaPoints}%`}
          trend={trend.direction}
          hint={`Last 7 days ${trend.recentPct}% · previous ${trend.previousPct}%`}
        />
      </div>

      {tasks.length === 0 ? (
        <section className="card p-5">
          <p className="font-data text-[11px] tracking-widest text-amber">FIRST THINGS</p>
          <h2 className="mt-2 text-lg font-semibold tracking-[-0.02em]">
            Nothing is tracked until you say what counts.
          </h2>

          <ol className="mt-4 space-y-3 text-sm">
            <li className="flex gap-3">
              <span className="font-data text-faint">01</span>
              <span className="text-muted">
                <Link href="/tasks" className="text-amber hover:text-amber-soft">
                  Add a few core tasks
                </Link>{" "}
                — the work that decides whether a day counted. There are suggestions if you want
                them.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="font-data text-faint">02</span>
              <span className="text-muted">
                Set your timezone, step goal and wake goal in{" "}
                <Link href="/settings" className="text-amber hover:text-amber-soft">
                  Settings
                </Link>
                . Everything daily depends on the timezone.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="font-data text-faint">03</span>
              <span className="text-muted">
                Finish them today. Your rating moves tonight, and the streak starts at one.
              </span>
            </li>
          </ol>

          <p className="mt-4 text-xs text-faint">
            Optional from there: paste problems, import a course, or start a SYNC with a friend.
          </p>
        </section>
      ) : null}

      <SharedToday tasks={sharedToday} dateKey={today} />

      <GapsCard gaps={gaps} />

      <MetricsForm
        dateKey={today}
        stepGoal={user.stepGoal}
        wakeGoalTime={user.wakeGoalTime}
        initial={{
          steps: metric?.steps ?? null,
          wakeTime: metric?.wakeTime ?? null,
          notes: metric?.notes ?? null,
        }}
      />

      {quote ? (
        <p className="border-l-2 border-line pl-4 text-sm text-muted">{quote.text}</p>
      ) : null}
    </div>
  );
}
