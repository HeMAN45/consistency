import type { DailySnapshot, Task } from "@prisma/client";

import { db } from "@/lib/db";
import { taskWasLiveOn } from "@/lib/progression";
import { consistencyScore, momentum, type Momentum } from "@/lib/rank";
import {
  dateToDayKey,
  dayKeyToDate,
  dayKeyRange,
  recentDayKeys,
  shiftDayKey,
  todayKey,
  type DayKey,
} from "@/lib/time";

/**
 * Everything here reads from stored data. No projections, no invented numbers —
 * an insight that isn't backed by a row doesn't get shown (PRD §36).
 */

export const HEATMAP_DAYS = 90;
export const WINDOW_DAYS = 30;

export type HeatmapDay = {
  date: DayKey;
  completionPct: number;
  coreCompleted: number;
  coreTotal: number;
  perfectDay: boolean;
  stepGoalMet: boolean;
  wakeGoalMet: boolean;
  steps: number | null;
  wakeTime: string | null;
  hasData: boolean;
};

export type CategoryStat = {
  /** The user's own label for CUSTOM tasks, otherwise the enum name. */
  category: string;
  scheduled: number;
  completed: number;
  pct: number;
  todayPct: number | null;
};

export type AnalyticsBundle = {
  today: DayKey;
  snapshots: DailySnapshot[];
  heatmap: HeatmapDay[];
  consistency: number;
  previousConsistency: number;
  momentum: Momentum;
  categories: CategoryStat[];
  weeklyTrend: { label: string; pct: number }[];
  stepsTrend: { date: DayKey; steps: number }[];
  wakeTrend: { date: DayKey; minutes: number }[];
  perfectDays: number;
  totalTracked: number;
  insights: string[];
};

function snapshotToScoreInput(s: DailySnapshot) {
  return {
    completionPct: s.completionPct,
    stepGoalMet: s.stepGoalMet,
    wakeGoalMet: s.wakeGoalMet,
    hadCoreTasks: s.coreTotal > 0,
  };
}

export async function loadAnalytics(user: {
  id: string;
  timezone: string;
  currentStreak: number;
  stepGoal: number;
}): Promise<AnalyticsBundle> {
  const today = todayKey(user.timezone);
  const windowStart = shiftDayKey(today, -(HEATMAP_DAYS - 1));

  const [snapshots, metrics, tasks, logs] = await Promise.all([
    db.dailySnapshot.findMany({
      where: { userId: user.id, date: { gte: dayKeyToDate(windowStart) } },
      orderBy: { date: "asc" },
    }),
    db.dailyMetric.findMany({
      where: { userId: user.id, date: { gte: dayKeyToDate(windowStart) } },
      orderBy: { date: "asc" },
    }),
    db.task.findMany({ where: { ownerUserId: user.id } }),
    db.taskLog.findMany({
      where: { userId: user.id, completed: true, date: { gte: dayKeyToDate(windowStart) } },
      select: { taskId: true, date: true },
    }),
  ]);

  const snapshotByDay = new Map(snapshots.map((s) => [dateToDayKey(s.date), s]));
  const metricByDay = new Map(metrics.map((m) => [dateToDayKey(m.date), m]));

  // ---------------------------------------------------------------- heatmap
  const heatmap: HeatmapDay[] = recentDayKeys(user.timezone, HEATMAP_DAYS).map((date) => {
    const s = snapshotByDay.get(date);
    const m = metricByDay.get(date);
    return {
      date,
      completionPct: s?.completionPct ?? 0,
      coreCompleted: s?.coreCompleted ?? 0,
      coreTotal: s?.coreTotal ?? 0,
      perfectDay: s?.perfectDay ?? false,
      stepGoalMet: s?.stepGoalMet ?? false,
      wakeGoalMet: s?.wakeGoalMet ?? false,
      steps: m?.steps ?? null,
      wakeTime: m?.wakeTime ?? null,
      hasData: Boolean(s && s.coreTotal > 0),
    };
  });

  // ------------------------------------------------------- scores and trend
  const recent = snapshots.filter((s) => dateToDayKey(s.date) > shiftDayKey(today, -WINDOW_DAYS));
  const previous = snapshots.filter((s) => {
    const key = dateToDayKey(s.date);
    return key <= shiftDayKey(today, -WINDOW_DAYS) && key > shiftDayKey(today, -WINDOW_DAYS * 2);
  });

  const consistency = consistencyScore(recent.map(snapshotToScoreInput), user.currentStreak);
  const previousConsistency = consistencyScore(previous.map(snapshotToScoreInput), 0);
  const momentumResult = momentum(snapshots.map(snapshotToScoreInput));

  const weeklyTrend: { label: string; pct: number }[] = [];
  for (let week = 5; week >= 0; week--) {
    const end = shiftDayKey(today, -week * 7);
    const start = shiftDayKey(end, -6);
    const inWeek = snapshots.filter((s) => {
      const key = dateToDayKey(s.date);
      return key >= start && key <= end && s.coreTotal > 0;
    });
    weeklyTrend.push({
      label: week === 0 ? "This week" : `−${week}w`,
      pct: inWeek.length
        ? Math.round((inWeek.reduce((sum, s) => sum + s.completionPct, 0) / inWeek.length) * 100)
        : 0,
    });
  }

  // ------------------------------------------------------------- categories
  const windowKeys = dayKeyRange(shiftDayKey(today, -(WINDOW_DAYS - 1)), today);
  const completedByDay = new Map<DayKey, Set<string>>();
  for (const log of logs) {
    const key = dateToDayKey(log.date);
    const set = completedByDay.get(key) ?? new Set<string>();
    set.add(log.taskId);
    completedByDay.set(key, set);
  }

  const groupOf = (task: Task) =>
    task.category === "CUSTOM" && task.customLabel ? task.customLabel : task.category;

  const tally = new Map<string, { scheduled: number; completed: number }>();
  const todayTally = new Map<string, { scheduled: number; completed: number }>();

  for (const key of windowKeys) {
    const doneToday = completedByDay.get(key) ?? new Set<string>();
    for (const task of tasks) {
      if (!task.isCore) continue;
      if (!taskWasLiveOn(task, key, user.timezone)) continue;

      const group = groupOf(task);
      const bucket = tally.get(group) ?? { scheduled: 0, completed: 0 };
      bucket.scheduled += 1;
      if (doneToday.has(task.id)) bucket.completed += 1;
      tally.set(group, bucket);

      if (key === today) {
        const t = todayTally.get(group) ?? { scheduled: 0, completed: 0 };
        t.scheduled += 1;
        if (doneToday.has(task.id)) t.completed += 1;
        todayTally.set(group, t);
      }
    }
  }

  const categories: CategoryStat[] = [...tally.entries()]
    .map(([category, { scheduled, completed }]) => {
      const t = todayTally.get(category);
      return {
        category,
        scheduled,
        completed,
        pct: scheduled ? completed / scheduled : 0,
        todayPct: t && t.scheduled ? t.completed / t.scheduled : null,
      };
    })
    .sort((a, b) => b.pct - a.pct);

  // ----------------------------------------------------------------- trends
  const stepsTrend = metrics
    .filter((m) => m.steps !== null)
    .map((m) => ({ date: dateToDayKey(m.date), steps: m.steps as number }));

  const wakeTrend = metrics
    .filter((m) => m.wakeTime)
    .map((m) => {
      const [h, min] = (m.wakeTime as string).split(":").map(Number);
      return { date: dateToDayKey(m.date), minutes: h * 60 + min };
    });

  const perfectDays = snapshots.filter((s) => s.perfectDay).length;
  const totalTracked = snapshots.filter((s) => s.coreTotal > 0).length;

  return {
    today,
    snapshots,
    heatmap,
    consistency,
    previousConsistency,
    momentum: momentumResult,
    categories,
    weeklyTrend,
    stepsTrend,
    wakeTrend,
    perfectDays,
    totalTracked,
    insights: buildInsights({
      consistency,
      previousConsistency,
      momentum: momentumResult,
      categories,
      perfectDays,
      totalTracked,
    }),
  };
}

/** Only states things the numbers already say. Nothing is extrapolated. */
function buildInsights(input: {
  consistency: number;
  previousConsistency: number;
  momentum: Momentum;
  categories: CategoryStat[];
  perfectDays: number;
  totalTracked: number;
}): string[] {
  const out: string[] = [];

  if (input.totalTracked < 3) {
    out.push("Log a few more days and this fills in with real patterns.");
    return out;
  }

  if (input.previousConsistency > 0) {
    const diff = input.consistency - input.previousConsistency;
    out.push(
      diff >= 0
        ? `Consistency is ${input.consistency} over the last 30 days, up from ${input.previousConsistency} in the 30 before.`
        : `Consistency is ${input.consistency} over the last 30 days, down from ${input.previousConsistency} in the 30 before.`,
    );
  } else {
    out.push(`Consistency is ${input.consistency} across ${input.totalTracked} tracked days.`);
  }

  if (input.momentum.direction !== "flat") {
    out.push(
      input.momentum.direction === "up"
        ? `Last 7 days averaged ${input.momentum.recentPct}%, against ${input.momentum.previousPct}% the week before.`
        : `Completion dropped to ${input.momentum.recentPct}% this week from ${input.momentum.previousPct}%.`,
    );
  }

  const strongest = input.categories[0];
  const weakest = input.categories[input.categories.length - 1];

  if (strongest && strongest.scheduled >= 3) {
    out.push(`${strongest.category} is your strongest category at ${Math.round(strongest.pct * 100)}%.`);
  }
  if (weakest && weakest !== strongest && weakest.scheduled >= 3) {
    out.push(`${weakest.category} is lagging at ${Math.round(weakest.pct * 100)}% of scheduled work.`);
  }

  if (input.perfectDays > 0) {
    out.push(`${input.perfectDays} perfect ${input.perfectDays === 1 ? "day" : "days"} in the last 90.`);
  }

  return out;
}

// ------------------------------------------------------------ weekly review

export type WeeklyReview = {
  consistency: number;
  previousConsistency: number;
  strongest: CategoryStat | null;
  weakest: CategoryStat | null;
  bestDay: { date: DayKey; pct: number } | null;
  worstDay: { date: DayKey; pct: number } | null;
  perfectDays: number;
  focus: string[];
};

export function buildWeeklyReview(bundle: AnalyticsBundle, timezone: string): WeeklyReview {
  const weekKeys = new Set(recentDayKeys(timezone, 7));
  const week = bundle.snapshots.filter(
    (s) => weekKeys.has(dateToDayKey(s.date)) && s.coreTotal > 0,
  );

  const sorted = [...week].sort((a, b) => b.completionPct - a.completionPct);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];

  const strongest = bundle.categories[0] ?? null;
  const weakest = bundle.categories.length > 1
    ? bundle.categories[bundle.categories.length - 1]
    : null;

  const focus: string[] = [];
  if (weakest) focus.push(`Lift ${weakest.category} — currently ${Math.round(weakest.pct * 100)}%.`);
  if (bundle.momentum.direction === "down") focus.push("Rebuild the week-on-week trend.");
  if (worst && worst.completionPct < 1) {
    focus.push(`Watch ${dateToDayKey(worst.date)} — your weakest day this week.`);
  }
  if (focus.length === 0) focus.push("Hold the current pace. Nothing is slipping.");

  return {
    consistency: bundle.consistency,
    previousConsistency: bundle.previousConsistency,
    strongest,
    weakest,
    bestDay: best ? { date: dateToDayKey(best.date), pct: best.completionPct } : null,
    worstDay: worst ? { date: dateToDayKey(worst.date), pct: worst.completionPct } : null,
    perfectDays: week.filter((s) => s.perfectDay).length,
    focus,
  };
}


// ------------------------------------------------------- year heatmap

export type YearDay = {
  date: DayKey;
  completionPct: number;
  coreCompleted: number;
  coreTotal: number;
  perfectDay: boolean;
  steps: number | null;
  wakeTime: string | null;
  restDay: boolean;
  hasData: boolean;
  inFuture: boolean;
};

export type YearHeatmap = {
  year: number;
  days: YearDay[];
  availableYears: number[];
  totals: { tracked: number; perfect: number; rest: number; averagePct: number };
};

/** Every day of a calendar year, whether or not anything was logged. */
export async function loadYearHeatmap(
  user: { id: string; timezone: string; createdAt: Date },
  year: number,
): Promise<YearHeatmap> {
  const today = todayKey(user.timezone);
  const currentYear = Number(today.slice(0, 4));
  const firstYear = Number(dateToDayKey(user.createdAt).slice(0, 4));

  const availableYears: number[] = [];
  for (let y = currentYear; y >= Math.min(firstYear, currentYear); y--) availableYears.push(y);

  const from = `${year}-01-01`;
  const to = `${year}-12-31`;

  const [snapshots, metrics, rests] = await Promise.all([
    db.dailySnapshot.findMany({
      where: {
        userId: user.id,
        date: { gte: dayKeyToDate(from), lte: dayKeyToDate(to) },
      },
    }),
    db.dailyMetric.findMany({
      where: {
        userId: user.id,
        date: { gte: dayKeyToDate(from), lte: dayKeyToDate(to) },
      },
      select: { date: true, steps: true, wakeTime: true },
    }),
    db.restDay.findMany({
      where: {
        userId: user.id,
        date: { gte: dayKeyToDate(from), lte: dayKeyToDate(to) },
      },
      select: { date: true },
    }),
  ]);

  const snapshotByDay = new Map(snapshots.map((s) => [dateToDayKey(s.date), s]));
  const metricByDay = new Map(metrics.map((m) => [dateToDayKey(m.date), m]));
  const restKeys = new Set(rests.map((r) => dateToDayKey(r.date)));

  const days: YearDay[] = dayKeyRange(from, to).map((date) => {
    const snapshot = snapshotByDay.get(date);
    const metric = metricByDay.get(date);

    return {
      date,
      completionPct: snapshot?.completionPct ?? 0,
      coreCompleted: snapshot?.coreCompleted ?? 0,
      coreTotal: snapshot?.coreTotal ?? 0,
      perfectDay: snapshot?.perfectDay ?? false,
      steps: metric?.steps ?? null,
      wakeTime: metric?.wakeTime ?? null,
      restDay: restKeys.has(date),
      hasData: Boolean(snapshot && snapshot.coreTotal > 0),
      inFuture: date > today,
    };
  });

  const tracked = days.filter((d) => d.hasData);

  return {
    year,
    days,
    availableYears,
    totals: {
      tracked: tracked.length,
      perfect: days.filter((d) => d.perfectDay).length,
      rest: days.filter((d) => d.restDay).length,
      averagePct: tracked.length
        ? Math.round((tracked.reduce((sum, d) => sum + d.completionPct, 0) / tracked.length) * 100)
        : 0,
    },
  };
}
