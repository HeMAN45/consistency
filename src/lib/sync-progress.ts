import { db } from "@/lib/db";
import {
  dateToDayKey,
  dayKeyRange,
  dayKeyToDate,
  shiftDayKey,
  taskAppliesOn,
  todayKey,
  type DayKey,
} from "@/lib/time";
import { GROUP_STREAK_THRESHOLD, MILESTONES } from "@/lib/sync-rules";

/**
 * Group progression, kept entirely separate from personal rank.
 *
 * A group streak day needs 80% of member-task slots filled, so one person
 * having a bad day doesn't cost everybody else theirs. A member who declared a
 * rest day is removed from the denominator rather than counted as a failure:
 * planned time off shouldn't punish the group.
 */

export {
  AT_RISK_AFTER_MINUTE,
  dayQualifies,
  GROUP_STREAK_THRESHOLD,
  isAtRisk,
  MILESTONES,
} from "@/lib/sync-rules";

const LOOKBACK_DAYS = 120;

export type GroupStreak = {
  current: number;
  longest: number;
  todayRatio: number;
  todayQualifies: boolean;
  threshold: number;
};

export async function groupStreak(syncId: string, timezone: string): Promise<GroupStreak> {
  const today = todayKey(timezone);
  const from = shiftDayKey(today, -(LOOKBACK_DAYS - 1));

  const [sync, members, tasks, logs] = await Promise.all([
    db.sync.findUnique({ where: { id: syncId }, select: { createdAt: true } }),
    db.syncMembership.findMany({
      where: { syncId, status: "ACCEPTED" },
      select: { userId: true },
    }),
    db.syncTask.findMany({
      where: { syncId },
      select: { id: true, dayType: true, scheduledDate: true, createdAt: true, archivedAt: true },
    }),
    db.syncTaskLog.findMany({
      where: { completed: true, syncTask: { syncId }, date: { gte: dayKeyToDate(from) } },
      select: { syncTaskId: true, userId: true, date: true },
    }),
  ]);

  const memberIds = members.map((m) => m.userId);

  const rests = await db.restDay.findMany({
    where: { userId: { in: memberIds }, date: { gte: dayKeyToDate(from) } },
    select: { userId: true, date: true },
  });

  const restBy = new Map<DayKey, Set<string>>();
  for (const rest of rests) {
    const key = dateToDayKey(rest.date);
    const set = restBy.get(key) ?? new Set<string>();
    set.add(rest.userId);
    restBy.set(key, set);
  }

  const filled = new Set(logs.map((l) => `${dateToDayKey(l.date)}:${l.syncTaskId}:${l.userId}`));
  const syncStart = sync ? dateToDayKey(sync.createdAt) : from;

  function ratioFor(key: DayKey): number | null {
    if (key < syncStart) return null;

    const live = tasks.filter(
      (task) =>
        dateToDayKey(task.createdAt) <= key &&
        (!task.archivedAt || dateToDayKey(task.archivedAt) > key) &&
        taskAppliesOn(task, key),
    );
    if (live.length === 0) return null;

    const resting = restBy.get(key) ?? new Set<string>();
    const eligible = memberIds.filter((id) => !resting.has(id));
    if (eligible.length === 0) return null;

    const slots = live.length * eligible.length;
    let done = 0;
    for (const task of live) {
      for (const memberId of eligible) {
        if (filled.has(`${key}:${task.id}:${memberId}`)) done += 1;
      }
    }
    return done / slots;
  }

  const keys = dayKeyRange(from, today);
  const ratios = new Map<DayKey, number | null>();
  for (const key of keys) ratios.set(key, ratioFor(key));

  const todayRatio = ratios.get(today) ?? 0;
  const todayQualifies = todayRatio !== null && todayRatio >= GROUP_STREAK_THRESHOLD;

  // Walk back from today. Today is provisional: it can extend the streak but
  // never break it, the same rule personal streaks follow.
  let current = 0;
  for (let i = keys.length - 1; i >= 0; i--) {
    const key = keys[i];
    const ratio = ratios.get(key) ?? null;

    if (ratio === null) continue; // nothing scheduled, or everyone resting
    if (ratio >= GROUP_STREAK_THRESHOLD) {
      current += 1;
      continue;
    }
    if (key === today) continue; // unfinished, not failed
    break;
  }

  let longest = 0;
  let run = 0;
  for (const key of keys) {
    const ratio = ratios.get(key) ?? null;
    if (ratio === null) continue;
    if (ratio >= GROUP_STREAK_THRESHOLD) {
      run += 1;
      longest = Math.max(longest, run);
    } else if (key !== today) {
      run = 0;
    }
  }

  return {
    current,
    longest: Math.max(longest, current),
    todayRatio: todayRatio ?? 0,
    todayQualifies,
    threshold: GROUP_STREAK_THRESHOLD,
  };
}

// ------------------------------------------------------------- milestones

export type ReachedMilestone = { threshold: number; groupPct: number };

/**
 * Group progress is the average of each member's own progress against their
 * own target, so a member aiming at 60 days isn't penalised next to one aiming
 * at 100. Crossings are recorded once and never re-fire.
 */
export async function evaluateMilestones(syncId: string): Promise<ReachedMilestone[]> {
  const goal = await db.syncGoal.findFirst({
    where: { syncId },
    orderBy: { createdAt: "asc" },
    select: { id: true, defaultTarget: true },
  });
  if (!goal) return [];

  const progress = await db.syncGoalProgress.findMany({
    where: { goalId: goal.id },
    select: { currentValue: true, memberTarget: true },
  });
  if (progress.length === 0) return [];

  const average =
    progress.reduce((sum, row) => {
      const target = row.memberTarget || goal.defaultTarget;
      return sum + (target > 0 ? Math.min(1, row.currentValue / target) : 0);
    }, 0) / progress.length;

  const groupPct = Math.round(average * 100);

  const existing = await db.syncMilestone.findMany({
    where: { goalId: goal.id },
    select: { threshold: true },
  });
  const already = new Set(existing.map((m) => m.threshold));

  const reached: ReachedMilestone[] = [];

  for (const threshold of MILESTONES) {
    if (groupPct < threshold || already.has(threshold)) continue;

    try {
      await db.syncMilestone.create({ data: { syncId, goalId: goal.id, threshold } });
      reached.push({ threshold, groupPct });
    } catch {
      // Unique constraint: another member crossed it in the same instant.
    }
  }

  return reached;
}

export async function listMilestones(syncId: string) {
  const rows = await db.syncMilestone.findMany({
    where: { syncId },
    orderBy: { threshold: "asc" },
    select: { threshold: true, reachedAt: true },
  });
  return rows;
}
