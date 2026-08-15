import { db } from "@/lib/db";
import { groupStreak, listMilestones } from "@/lib/sync-progress";
import { describeSeason, isAtRisk, MILESTONES, seasonIsWritable } from "@/lib/sync-rules";
import { seasonSummary, weeklySyncReview } from "@/lib/sync-review";
import { dateToDayKey, dayKeyToDate, taskAppliesOn, todayKey, type DayKey } from "@/lib/time";

/**
 * Membership is checked in the database on every read. Being someone's friend
 * grants nothing here, and knowing a SYNC id grants nothing either — the id is
 * a lookup key, never an authorization.
 */

const MEMBER_FIELDS = {
  id: true,
  username: true,
  displayName: true,
  rating: true,
  currentStreak: true,
} as const;

export async function requireMembership(syncId: string, userId: string) {
  const membership = await db.syncMembership.findUnique({
    where: { syncId_userId: { syncId, userId } },
    select: { id: true, status: true },
  });

  if (!membership || membership.status !== "ACCEPTED") return null;

  const sync = await db.sync.findUnique({
    where: { id: syncId },
    select: {
      id: true,
      name: true,
      description: true,
      ownerUserId: true,
      startDate: true,
      endDate: true,
      createdAt: true,
      archivedAt: true,
    },
  });

  if (!sync || sync.archivedAt) return null;
  return { sync, isOwner: sync.ownerUserId === userId };
}

/**
 * Goal progress is earned, not typed in: it counts the days on which a member
 * completed at least one of the SYNC's tasks, from the goal's start date.
 */
async function progressByMember(syncId: string, goalStart: Date, memberIds: string[]) {
  const logs = await db.syncTaskLog.findMany({
    where: {
      completed: true,
      userId: { in: memberIds },
      date: { gte: goalStart },
      syncTask: { syncId },
    },
    select: { userId: true, date: true },
  });

  const daysByMember = new Map<string, Set<string>>();
  for (const log of logs) {
    const set = daysByMember.get(log.userId) ?? new Set<string>();
    set.add(dateToDayKey(log.date));
    daysByMember.set(log.userId, set);
  }

  return daysByMember;
}

export type SyncRoom = Awaited<ReturnType<typeof loadSyncRoom>>;

export async function loadSyncRoom(syncId: string, userId: string, timezone: string) {
  const access = await requireMembership(syncId, userId);
  if (!access) return null;

  const today = todayKey(timezone);

  const [members, goal, tasks, todayLogs, activity] = await Promise.all([
    db.syncMembership.findMany({
      where: { syncId, status: "ACCEPTED" },
      select: {
        id: true,
        userId: true,
        user: { select: { ...MEMBER_FIELDS, timezone: true, allowNudges: true } },
      },
      orderBy: { invitedAt: "asc" },
    }),
    db.syncGoal.findFirst({ where: { syncId }, orderBy: { createdAt: "asc" } }),
    db.syncTask.findMany({
      where: { syncId, isActive: true, archivedAt: null },
      orderBy: [{ isCore: "desc" }, { sortOrder: "asc" }],
    }),
    db.syncTaskLog.findMany({
      where: { date: dayKeyToDate(today), syncTask: { syncId } },
      select: { syncTaskId: true, userId: true, completed: true },
    }),
    // Recent completions across the whole SYNC, for the activity view.
    db.syncTaskLog.findMany({
      where: { completed: true, syncTask: { syncId }, completedAt: { not: null } },
      orderBy: { completedAt: "desc" },
      take: 25,
      select: {
        id: true,
        completedAt: true,
        userId: true,
        user: { select: { displayName: true } },
        syncTask: { select: { name: true } },
      },
    }),
  ]);

  const memberIds = members.map((m) => m.userId);

  const [streak, milestones, restsToday, nudgesToday] = await Promise.all([
    groupStreak(syncId, timezone),
    listMilestones(syncId),
    db.restDay.findMany({
      where: { userId: { in: memberIds }, date: dayKeyToDate(today) },
      select: { userId: true },
    }),
    db.nudge.findMany({
      where: { syncId, fromUserId: userId, date: dayKeyToDate(today) },
      select: { toUserId: true },
    }),
  ]);

  const restingToday = new Set(restsToday.map((r) => r.userId));
  const nudgedToday = new Set(nudgesToday.map((n) => n.toUserId));

  const season = describeSeason(
    access.sync.startDate ? dateToDayKey(access.sync.startDate) : null,
    access.sync.endDate ? dateToDayKey(access.sync.endDate) : null,
    today,
  );

  const [review, summary] = await Promise.all([
    weeklySyncReview(syncId, userId, timezone),
    season.status === "ended" ? seasonSummary(syncId, timezone) : Promise.resolve(null),
  ]);

  const [goalProgressRows, earnedDays] = await Promise.all([
    goal
      ? db.syncGoalProgress.findMany({ where: { goalId: goal.id } })
      : Promise.resolve([]),
    goal ? progressByMember(syncId, goal.startDate, memberIds) : Promise.resolve(new Map()),
  ]);

  const targetByMember = new Map(goalProgressRows.map((p) => [p.userId, p.memberTarget]));

  const scheduledToday = tasks.filter((t) => taskAppliesOn(t, today));
  const completedToday = new Set(
    todayLogs.filter((l) => l.completed).map((l) => `${l.syncTaskId}:${l.userId}`),
  );

  const memberViews = members.map((m) => {
    const done = (earnedDays.get(m.userId) as Set<string> | undefined)?.size ?? 0;
    const target = targetByMember.get(m.userId) ?? goal?.defaultTarget ?? 0;

    const completedToday_ = scheduledToday.filter((task) =>
      completedToday.has(`${task.id}:${m.userId}`),
    ).length;

    return {
      atRisk: isAtRisk({
        timezone: m.user.timezone,
        scheduledCount: scheduledToday.length,
        completedCount: completedToday_,
        onRestDay: restingToday.has(m.userId),
      }),
      onRestDay: restingToday.has(m.userId),
      nudgedByYou: nudgedToday.has(m.userId),
      acceptsNudges: m.user.allowNudges,
      doneToday: completedToday_,
      scheduledToday: scheduledToday.length,
      userId: m.userId,
      username: m.user.username,
      displayName: m.user.displayName,
      rating: m.user.rating,
      streak: m.user.currentStreak,
      progress: done,
      target,
      pct: target > 0 ? Math.min(1, done / target) : 0,
      isYou: m.userId === userId,
    };
  });

  // Group activity: how much of today's shared work the whole SYNC has cleared.
  const totalSlots = scheduledToday.length * members.length;
  const filledSlots = scheduledToday.reduce(
    (sum, task) =>
      sum + members.filter((m) => completedToday.has(`${task.id}:${m.userId}`)).length,
    0,
  );

  return {
    sync: access.sync,
    isOwner: access.isOwner,
    goal,
    members: memberViews,
    today,
    tasks: scheduledToday.map((task) => ({
      id: task.id,
      name: task.name,
      category: task.category,
      isCore: task.isCore,
      createdByUserId: task.createdByUserId,
      canRemove: access.isOwner || task.createdByUserId === userId,
      completions: members.map((m) => ({
        userId: m.userId,
        displayName: m.user.displayName,
        completed: completedToday.has(`${task.id}:${m.userId}`),
        isYou: m.userId === userId,
      })),
    })),
    groupActivity: totalSlots === 0 ? 0 : filledSlots / totalSlots,
    season,
    writable: seasonIsWritable(season.status),
    review,
    summary,
    streak,
    milestones: MILESTONES.map((threshold) => ({
      threshold,
      reached: milestones.some((m) => m.threshold === threshold),
    })),
    activity: activity.map((entry) => ({
      id: entry.id,
      at: (entry.completedAt as Date).toISOString(),
      displayName: entry.user.displayName,
      taskName: entry.syncTask.name,
      isYou: entry.userId === userId,
    })),
  };
}

export async function listSyncs(userId: string) {
  const memberships = await db.syncMembership.findMany({
    where: { userId, status: "ACCEPTED" },
    select: {
      sync: {
        select: {
          id: true,
          name: true,
          description: true,
          archivedAt: true,
          goals: { orderBy: { createdAt: "asc" }, take: 1 },
          _count: { select: { members: { where: { status: "ACCEPTED" } } } },
        },
      },
    },
  });

  const active = memberships.map((m) => m.sync).filter((s) => !s.archivedAt);

  return Promise.all(
    active.map(async (sync) => {
      const goal = sync.goals[0];
      let pct = 0;

      if (goal) {
        const days = await progressByMember(sync.id, goal.startDate, [userId]);
        const done = days.get(userId)?.size ?? 0;
        const row = await db.syncGoalProgress.findUnique({
          where: { goalId_userId: { goalId: goal.id, userId } },
          select: { memberTarget: true },
        });
        const target = row?.memberTarget ?? goal.defaultTarget;
        pct = target > 0 ? Math.min(1, done / target) : 0;
      }

      return {
        id: sync.id,
        name: sync.name,
        description: sync.description,
        memberCount: sync._count.members,
        goalTitle: goal?.title ?? null,
        pct,
      };
    }),
  );
}

export async function pendingInvites(userId: string) {
  return db.syncMembership.findMany({
    where: { userId, status: "INVITED" },
    select: {
      id: true,
      sync: { select: { id: true, name: true, description: true } },
      invitedBy: { select: { displayName: true } },
    },
  });
}

/** Recomputes the denormalised progress column after a completion changes. */
export async function refreshGoalProgress(syncId: string, userId: string) {
  const goal = await db.syncGoal.findFirst({
    where: { syncId },
    orderBy: { createdAt: "asc" },
  });
  if (!goal) return;

  const days = await progressByMember(syncId, goal.startDate, [userId]);
  const value = days.get(userId)?.size ?? 0;

  await db.syncGoalProgress.upsert({
    where: { goalId_userId: { goalId: goal.id, userId } },
    update: { currentValue: value },
    create: {
      goalId: goal.id,
      userId,
      memberTarget: goal.defaultTarget,
      currentValue: value,
    },
  });
}

export function todayKeyFor(timezone: string): DayKey {
  return todayKey(timezone);
}
