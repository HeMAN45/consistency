import { db } from "@/lib/db";
import { seasonStatus } from "@/lib/sync-rules";
import { seasonSummary } from "@/lib/sync-review";
import {
  dateToDayKey,
  dayKeyToDate,
  formatDayKey,
  recentDayKeys,
  taskAppliesOn,
  todayKey,
  type DayKey,
} from "@/lib/time";

/**
 * The archive is a record, not a bin.
 *
 * A season that ends stays readable: what it was, who did what, and every day
 * you logged inside it. Deleting is possible, but it is an explicit choice made
 * from here rather than something that happens to you when a date passes.
 */

export type ArchivedSync = {
  id: string;
  name: string;
  goalTitle: string | null;
  startDate: DayKey | null;
  endDate: DayKey | null;
  memberCount: number;
  isOwner: boolean;
  archived: boolean;
  standings: { displayName: string; done: number; total: number; pct: number }[];
};

export async function listArchivedSyncs(
  userId: string,
  timezone: string,
): Promise<ArchivedSync[]> {
  const today = todayKey(timezone);

  const memberships = await db.syncMembership.findMany({
    where: { userId, status: "ACCEPTED" },
    select: {
      sync: {
        select: {
          id: true,
          name: true,
          ownerUserId: true,
          startDate: true,
          endDate: true,
          archivedAt: true,
          goals: { orderBy: { createdAt: "asc" }, take: 1, select: { title: true } },
          _count: { select: { members: { where: { status: "ACCEPTED" } } } },
        },
      },
    },
  });

  const closed = memberships
    .map((membership) => membership.sync)
    .filter((sync) => {
      const status = seasonStatus(
        sync.startDate ? dateToDayKey(sync.startDate) : null,
        sync.endDate ? dateToDayKey(sync.endDate) : null,
        today,
      );
      return Boolean(sync.archivedAt) || status === "ended";
    });

  return Promise.all(
    closed.map(async (sync) => {
      const summary = await seasonSummary(sync.id, timezone).catch(() => null);

      return {
        id: sync.id,
        name: sync.name,
        goalTitle: sync.goals[0]?.title ?? null,
        startDate: sync.startDate ? dateToDayKey(sync.startDate) : null,
        endDate: sync.endDate ? dateToDayKey(sync.endDate) : null,
        memberCount: sync._count.members,
        isOwner: sync.ownerUserId === userId,
        archived: Boolean(sync.archivedAt),
        standings: summary?.standings ?? [],
      };
    }),
  );
}

export type ArchivedDay = {
  date: DayKey;
  label: string;
  coreCompleted: number;
  coreTotal: number;
  completionPct: number;
  perfectDay: boolean;
  restDay: boolean;
  hadData: boolean;
};

export async function listArchivedDays(
  userId: string,
  timezone: string,
  count = 60,
): Promise<ArchivedDay[]> {
  const keys = recentDayKeys(timezone, count);
  const today = todayKey(timezone);

  const [snapshots, rests] = await Promise.all([
    db.dailySnapshot.findMany({
      where: { userId, date: { gte: dayKeyToDate(keys[0]) } },
    }),
    db.restDay.findMany({
      where: { userId, date: { gte: dayKeyToDate(keys[0]) } },
      select: { date: true },
    }),
  ]);

  const byDay = new Map(snapshots.map((snapshot) => [dateToDayKey(snapshot.date), snapshot]));
  const restKeys = new Set(rests.map((rest) => dateToDayKey(rest.date)));

  return keys
    .filter((key) => key <= today)
    .reverse()
    .map((key) => {
      const snapshot = byDay.get(key);
      return {
        date: key,
        label: formatDayKey(key, "EEE d MMM"),
        coreCompleted: snapshot?.coreCompleted ?? 0,
        coreTotal: snapshot?.coreTotal ?? 0,
        completionPct: snapshot?.completionPct ?? 0,
        perfectDay: snapshot?.perfectDay ?? false,
        restDay: restKeys.has(key),
        hadData: Boolean(snapshot && snapshot.coreTotal > 0),
      };
    });
}

export type DayDetail = {
  date: DayKey;
  label: string;
  restDay: boolean;
  core: { name: string; category: string; completed: boolean; linkUrl: string | null }[];
  bonus: { name: string; category: string; completed: boolean; linkUrl: string | null }[];
  shared: { name: string; syncName: string; completed: boolean }[];
  metrics: {
    steps: number | null;
    wakeTime: string | null;
    notes: string | null;
    missReason: string | null;
  } | null;
  focusMinutes: number;
};

/** Exactly what that day looked like, done and undone. */
export async function loadDayDetail(
  userId: string,
  timezone: string,
  key: DayKey,
): Promise<DayDetail> {
  const [tasks, logs, syncTasks, syncLogs, metric, rest, focus] = await Promise.all([
    db.task.findMany({
      where: { ownerUserId: userId },
      select: {
        id: true,
        name: true,
        category: true,
        customLabel: true,
        dayType: true,
        scheduledDate: true,
        isCore: true,
        linkUrl: true,
        createdAt: true,
        archivedAt: true,
      },
    }),
    db.taskLog.findMany({
      where: { userId, date: dayKeyToDate(key), completed: true },
      select: { taskId: true },
    }),
    db.syncTask.findMany({
      where: {
        sync: { members: { some: { userId, status: "ACCEPTED" } } },
      },
      select: {
        id: true,
        name: true,
        dayType: true,
        scheduledDate: true,
        createdAt: true,
        archivedAt: true,
        sync: { select: { name: true } },
      },
    }),
    db.syncTaskLog.findMany({
      where: { userId, date: dayKeyToDate(key), completed: true },
      select: { syncTaskId: true },
    }),
    db.dailyMetric.findUnique({
      where: { userId_date: { userId, date: dayKeyToDate(key) } },
      select: { steps: true, wakeTime: true, notes: true, missReason: true },
    }),
    db.restDay.findUnique({
      where: { userId_date: { userId, date: dayKeyToDate(key) } },
      select: { id: true },
    }),
    db.focusSession.aggregate({
      where: {
        userId,
        completed: true,
        startedAt: {
          gte: dayKeyToDate(key),
          lt: new Date(dayKeyToDate(key).getTime() + 86_400_000),
        },
      },
      _sum: { elapsedSeconds: true },
    }),
  ]);

  const completed = new Set(logs.map((log) => log.taskId));
  const sharedDone = new Set(syncLogs.map((log) => log.syncTaskId));

  // A task belongs to a day only if it existed then and applied to it.
  const live = tasks.filter(
    (task) =>
      dateToDayKey(task.createdAt) <= key &&
      (!task.archivedAt || dateToDayKey(task.archivedAt) > key) &&
      taskAppliesOn(task, key),
  );

  const shape = (task: (typeof live)[number]) => ({
    name: task.name,
    category: task.category === "CUSTOM" && task.customLabel ? task.customLabel : task.category,
    completed: completed.has(task.id),
    linkUrl: task.linkUrl,
  });

  const liveShared = syncTasks.filter(
    (task) =>
      dateToDayKey(task.createdAt) <= key &&
      (!task.archivedAt || dateToDayKey(task.archivedAt) > key) &&
      taskAppliesOn(task, key),
  );

  return {
    date: key,
    label: formatDayKey(key, "EEEE d MMMM yyyy"),
    restDay: Boolean(rest),
    core: live.filter((task) => task.isCore).map(shape),
    bonus: live.filter((task) => !task.isCore).map(shape),
    shared: liveShared.map((task) => ({
      name: task.name,
      syncName: task.sync.name,
      completed: sharedDone.has(task.id),
    })),
    metrics: metric,
    focusMinutes: Math.round((focus._sum.elapsedSeconds ?? 0) / 60),
  };
}
