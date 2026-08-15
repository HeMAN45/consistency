import type { DailyMetric, Prisma, Task, TaskLog } from "@prisma/client";

import { evaluateAchievements, type UnlockedAchievement } from "@/lib/achievements";
import { db } from "@/lib/db";
import {
  applyRatingDelta,
  COMEBACK_DAYS,
  ratingDeltaForDay,
  TIERS,
  tierFor,
  xpForDay,
} from "@/lib/rank";
import {
  dayKeyFor,
  dayKeyRange,
  dayKeyToDate,
  dateToDayKey,
  shiftDayKey,
  taskAppliesOn,
  todayKey,
  type DayKey,
} from "@/lib/time";

/**
 * The only place progression is calculated.
 *
 * Rating is cumulative, so editing a past day means replaying every day after
 * it. `recomputeFrom` does exactly that: rebuild each DailySnapshot in order,
 * carry rating and streak forward, then write the totals back onto User.
 *
 * Today is provisional. An unfinished day never subtracts rating and never
 * resets the streak — that only happens once the day closes in the user's
 * timezone and a later day is replayed over it.
 */

// Re-exported so existing imports keep working; the implementation lives in a
// database-free module so it can be unit tested.
export { BACKFILL_DAYS, isWithinBackfillWindow } from "@/lib/backfill";

/** Hard cap so a very old account can't replay thousands of days in one request. */
const MAX_REPLAY_DAYS = 400;

type DayInputs = {
  tasks: Task[];
  logsByDay: Map<DayKey, TaskLog[]>;
  metricsByDay: Map<DayKey, DailyMetric>;
  restDays: Set<DayKey>;
};

export type DayComputation = {
  date: DayKey;
  coreTotal: number;
  coreCompleted: number;
  bonusCompleted: number;
  completionPct: number;
  perfectDay: boolean;
  stepGoalMet: boolean;
  wakeGoalMet: boolean;
  xpEarned: number;
  ratingDelta: number;
  ratingAfter: number;
  streakAfter: number;
};

/**
 * A task counts on a day only if it existed then and hadn't been archived yet.
 * Without this, adding a task today would retroactively break old perfect days.
 */
export function taskWasLiveOn(task: Task, key: DayKey, timezone: string): boolean {
  if (dayKeyFor(task.createdAt, timezone) > key) return false;
  if (task.archivedAt && dayKeyFor(task.archivedAt, timezone) <= key) return false;
  return taskAppliesOn(task, key);
}

function computeDay(
  key: DayKey,
  timezone: string,
  inputs: DayInputs,
  ratingBefore: number,
  streakBefore: number,
  isToday: boolean,
): DayComputation {
  const live = inputs.tasks.filter((task) => taskWasLiveOn(task, key, timezone));
  const coreTasks = live.filter((t) => t.isCore);
  const bonusTasks = live.filter((t) => !t.isCore);

  const logs = inputs.logsByDay.get(key) ?? [];
  const completedIds = new Set(logs.filter((l) => l.completed).map((l) => l.taskId));

  // A declared rest day is treated as having nothing scheduled: the rating
  // holds, the streak holds, and it is not counted as a miss.
  const resting = inputs.restDays.has(key);

  const coreTotal = resting ? 0 : coreTasks.length;
  const coreCompleted = resting ? 0 : coreTasks.filter((t) => completedIds.has(t.id)).length;
  const bonusCompleted = bonusTasks.filter((t) => completedIds.has(t.id)).length;
  const completionPct = coreTotal === 0 ? 0 : coreCompleted / coreTotal;
  const perfectDay = coreTotal > 0 && coreCompleted === coreTotal;

  const metric = inputs.metricsByDay.get(key);
  const stepGoalMet = metric?.stepGoalMet ?? false;
  const wakeGoalMet = metric?.wokeUpOnTime ?? false;

  const rawDelta = ratingDeltaForDay({
    completionPct,
    perfectDay,
    stepGoalMet,
    wakeGoalMet,
    streakBefore,
    hadCoreTasks: coreTotal > 0,
  });

  // Provisional rule: a day still in progress can only help you.
  const ratingDelta = isToday && !perfectDay ? 0 : rawDelta;

  const streakAfter = perfectDay
    ? streakBefore + 1
    : coreTotal === 0 || isToday
      ? streakBefore // rest days and unfinished days hold the streak
      : 0;

  return {
    date: key,
    coreTotal,
    coreCompleted,
    bonusCompleted,
    completionPct,
    perfectDay,
    stepGoalMet,
    wakeGoalMet,
    xpEarned: xpForDay({ coreCompleted, bonusCompleted, perfectDay, stepGoalMet, wakeGoalMet }),
    ratingDelta,
    ratingAfter: applyRatingDelta(ratingBefore, ratingDelta),
    streakAfter,
  };
}

export async function recomputeFrom(userId: string, fromKey: DayKey) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, timezone: true, tier: true, longestStreak: true, createdAt: true },
  });
  if (!user) return null;

  const { timezone } = user;
  const today = todayKey(timezone);
  const accountStart = dayKeyFor(user.createdAt, timezone);

  let start = fromKey < accountStart ? accountStart : fromKey;
  const earliestAllowed = shiftDayKey(today, -MAX_REPLAY_DAYS);
  if (start < earliestAllowed) start = earliestAllowed;
  if (start > today) start = today;

  const keys = dayKeyRange(start, today);

  // Carry state in from the day before the replay window.
  const previous = await db.dailySnapshot.findUnique({
    where: { userId_date: { userId, date: dayKeyToDate(shiftDayKey(start, -1)) } },
    select: { ratingAfter: true, streakAfter: true },
  });

  let rating = previous?.ratingAfter ?? 0;
  let streak = previous?.streakAfter ?? 0;

  // Four queries for the whole window, no per-day round trips.
  const [tasks, logs, metrics, rests] = await Promise.all([
    db.task.findMany({ where: { ownerUserId: userId } }),
    db.taskLog.findMany({
      where: {
        userId,
        date: { gte: dayKeyToDate(start), lte: dayKeyToDate(today) },
      },
    }),
    db.dailyMetric.findMany({
      where: {
        userId,
        date: { gte: dayKeyToDate(start), lte: dayKeyToDate(today) },
      },
    }),
    db.restDay.findMany({
      where: {
        userId,
        date: { gte: dayKeyToDate(start), lte: dayKeyToDate(today) },
      },
      select: { date: true },
    }),
  ]);

  const logsByDay = new Map<DayKey, TaskLog[]>();
  for (const log of logs) {
    const key = dateToDayKey(log.date);
    const bucket = logsByDay.get(key);
    if (bucket) bucket.push(log);
    else logsByDay.set(key, [log]);
  }

  const metricsByDay = new Map<DayKey, DailyMetric>();
  for (const metric of metrics) metricsByDay.set(dateToDayKey(metric.date), metric);

  const inputs: DayInputs = {
    tasks,
    logsByDay,
    metricsByDay,
    restDays: new Set(rests.map((r) => dateToDayKey(r.date))),
  };
  const computed: DayComputation[] = [];

  for (const key of keys) {
    const day = computeDay(key, timezone, inputs, rating, streak, key === today);
    rating = day.ratingAfter;
    streak = day.streakAfter;
    computed.push(day);
  }

  await db.$transaction(
    computed.map((day) => {
      const data = {
        coreTotal: day.coreTotal,
        coreCompleted: day.coreCompleted,
        bonusCompleted: day.bonusCompleted,
        completionPct: day.completionPct,
        perfectDay: day.perfectDay,
        stepGoalMet: day.stepGoalMet,
        wakeGoalMet: day.wakeGoalMet,
        xpEarned: day.xpEarned,
        ratingDelta: day.ratingDelta,
        ratingAfter: day.ratingAfter,
        streakAfter: day.streakAfter,
        computedAt: new Date(),
      } satisfies Prisma.DailySnapshotUncheckedUpdateInput;

      return db.dailySnapshot.upsert({
        where: { userId_date: { userId, date: dayKeyToDate(day.date) } },
        update: data,
        create: { userId, date: dayKeyToDate(day.date), ...data },
      });
    }),
  );

  // Totals are aggregated rather than incremented, so a replay can't double count.
  const [snapshotTotals, focusTotals] = await Promise.all([
    db.dailySnapshot.aggregate({ where: { userId }, _sum: { xpEarned: true } }),
    db.focusSession.aggregate({ where: { userId }, _sum: { xpAwarded: true } }),
  ]);

  const xp = (snapshotTotals._sum.xpEarned ?? 0) + (focusTotals._sum.xpAwarded ?? 0);
  const tier = tierFor(rating).tier;
  const longestStreak = Math.max(user.longestStreak, streak);

  await db.user.update({
    where: { id: userId },
    data: {
      rating,
      tier,
      xp,
      currentStreak: streak,
      longestStreak,
      lastActiveAt: new Date(),
    },
  });

  const unlocked = await evaluateAchievements(userId);

  if (tier !== user.tier) {
    await db.rankHistory.create({
      data: {
        userId,
        fromTier: user.tier,
        toTier: tier,
        rating,
        isPromo:
          TIERS.findIndex((t) => t.tier === tier) >
          TIERS.findIndex((t) => t.tier === user.tier),
      },
    });
  }

  return {
    rating,
    tier,
    xp,
    currentStreak: streak,
    longestStreak,
    tierChanged: tier !== user.tier,
    promoted:
      TIERS.findIndex((t) => t.tier === tier) > TIERS.findIndex((t) => t.tier === user.tier),
    previousTier: user.tier,
    unlocked,
    today: computed[computed.length - 1] ?? null,
  };
}

/** Convenience for the common case: something changed on one day. */
export function recomputeDay(userId: string, key: DayKey) {
  return recomputeFrom(userId, key);
}

// ---------------------------------------------------------------- comeback

export type ComebackState = {
  active: boolean;
  day: number;
  target: number;
  brokenFrom: number;
};

/**
 * A broken streak shouldn't make the product useless (PRD §42). If a streak of
 * three or more ended in the last week, the next three days are a rebuild.
 * Derived from snapshots — nothing extra is stored.
 */
export async function comebackState(
  userId: string,
  timezone: string,
): Promise<ComebackState | null> {
  const today = todayKey(timezone);
  const window = 10;

  const snapshots = await db.dailySnapshot.findMany({
    where: { userId, date: { gte: dayKeyToDate(shiftDayKey(today, -window)) } },
    orderBy: { date: "asc" },
    select: { date: true, streakAfter: true, perfectDay: true, coreTotal: true },
  });

  if (snapshots.length < 2) return null;

  let breakIndex = -1;
  let brokenFrom = 0;

  for (let i = 1; i < snapshots.length; i++) {
    const previous = snapshots[i - 1];
    const current = snapshots[i];
    if (previous.streakAfter >= 3 && current.streakAfter === 0) {
      breakIndex = i;
      brokenFrom = previous.streakAfter;
    }
  }

  if (breakIndex === -1) return null;

  const since = snapshots.slice(breakIndex);
  const rebuilt = since.filter((s) => s.perfectDay).length;

  if (rebuilt >= COMEBACK_DAYS) return null; // rebuilt, mode over

  return {
    active: true,
    day: rebuilt + 1,
    target: COMEBACK_DAYS,
    brokenFrom,
  };
}
