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
import { GROUP_STREAK_THRESHOLD } from "@/lib/sync-rules";

/**
 * Everything here is derived from SYNC data only. The "how am I doing" line is
 * a member compared against their own SYNC history, never against their
 * personal tasks, which would leak private data into a shared room.
 */

type Slot = { key: DayKey; taskId: string; userId: string; done: boolean };

async function loadSlots(syncId: string, from: DayKey, to: DayKey) {
  const [members, tasks, logs, rests] = await Promise.all([
    db.syncMembership.findMany({
      where: { syncId, status: "ACCEPTED" },
      select: {
        userId: true,
        user: {
          select: {
            displayName: true,
          },
        },
      },
    }),
    db.syncTask.findMany({
      where: { syncId },
      select: {
        id: true,
        name: true,
        dayType: true,
        scheduledDate: true,
        createdAt: true,
        archivedAt: true,
      },
    }),
    db.syncTaskLog.findMany({
      where: {
        completed: true,
        syncTask: { syncId },
        date: {
          gte: dayKeyToDate(from),
          lte: dayKeyToDate(to),
        },
      },
      select: {
        syncTaskId: true,
        userId: true,
        date: true,
      },
    }),
    db.restDay.findMany({
      where: {
        date: {
          gte: dayKeyToDate(from),
          lte: dayKeyToDate(to),
        },
      },
      select: {
        userId: true,
        date: true,
      },
    }),
  ]);

  const done = new Set(
    logs.map(
      (l) =>
        `${dateToDayKey(l.date)}:${l.syncTaskId}:${l.userId}`,
    ),
  );

  const resting = new Set(
    rests.map(
      (r) =>
        `${dateToDayKey(r.date)}:${r.userId}`,
    ),
  );

  const slots: Slot[] = [];

  for (const key of dayKeyRange(from, to)) {
    const live = tasks.filter(
      (task) =>
        dateToDayKey(task.createdAt) <= key &&
        (!task.archivedAt ||
          dateToDayKey(task.archivedAt) > key) &&
        taskAppliesOn(task, key),
    );

    for (const task of live) {
      for (const member of members) {
        if (resting.has(`${key}:${member.userId}`)) continue;

        slots.push({
          key,
          taskId: task.id,
          userId: member.userId,
          done: done.has(
            `${key}:${task.id}:${member.userId}`,
          ),
        });
      }
    }
  }

  return { slots, members, tasks };
}

function ratio(slots: Slot[]) {
  if (slots.length === 0) return 0;

  return (
    slots.filter((s) => s.done).length / slots.length
  );
}

export type SyncReview = {
  thisWeek: number;
  lastWeek: number;
  deltaPoints: number;
  qualifyingDays: number;
  bestDay: { date: DayKey; ratio: number } | null;
  weakestTask: { name: string; ratio: number } | null;
  mostImproved: {
    displayName: string;
    deltaPoints: number;
  } | null;
  members: {
    userId: string;
    displayName: string;
    done: number;
    total: number;
    pct: number;
  }[];
  you: {
    thisWeek: number;
    trailing: number;
    deltaPoints: number;
    hasHistory: boolean;
  };
};

export async function weeklySyncReview(
  syncId: string,
  userId: string,
  timezone: string,
): Promise<SyncReview | null> {
  const today = todayKey(timezone);
  const from = shiftDayKey(today, -29);

  const { slots, members, tasks } = await loadSlots(
    syncId,
    from,
    today,
  );

  if (slots.length === 0) return null;

  const weekStart = shiftDayKey(today, -6);
  const previousStart = shiftDayKey(today, -13);

  const week = slots.filter(
    (s) => s.key >= weekStart,
  );

  const previous = slots.filter(
    (s) =>
      s.key >= previousStart &&
      s.key < weekStart,
  );

  const thisWeek = ratio(week);
  const lastWeek = ratio(previous);

  // Days in the week that cleared the group bar.
  const byDay = new Map<DayKey, Slot[]>();

  for (const slot of week) {
    const bucket = byDay.get(slot.key) ?? [];

    bucket.push(slot);
    byDay.set(slot.key, bucket);
  }

  let qualifyingDays = 0;
  let bestDay: {
    date: DayKey;
    ratio: number;
  } | null = null;

  for (const [key, daySlots] of byDay) {
    const dayRatio = ratio(daySlots);

    if (dayRatio >= GROUP_STREAK_THRESHOLD) {
      qualifyingDays += 1;
    }

    if (
      !bestDay ||
      dayRatio > bestDay.ratio
    ) {
      bestDay = {
        date: key,
        ratio: dayRatio,
      };
    }
  }

  // Weakest shared task this week.
  let weakestTask: {
    name: string;
    ratio: number;
  } | null = null;

  for (const task of tasks) {
    const taskSlots = week.filter(
      (s) => s.taskId === task.id,
    );

    if (taskSlots.length === 0) continue;

    const taskRatio = ratio(taskSlots);

    if (
      !weakestTask ||
      taskRatio < weakestTask.ratio
    ) {
      weakestTask = {
        name: task.name,
        ratio: taskRatio,
      };
    }
  }

  // Per member, plus who moved the most week on week.
  const memberRows = members.map((member) => {
    const mine = week.filter(
      (s) => s.userId === member.userId,
    );

    const done = mine.filter(
      (s) => s.done,
    ).length;

    return {
      userId: member.userId,

      // FIX: displayName is inside the related user object.
      displayName: member.user.displayName,

      done,
      total: mine.length,
      pct:
        mine.length === 0
          ? 0
          : done / mine.length,
    };
  });

  let mostImproved: {
    displayName: string;
    deltaPoints: number;
  } | null = null;

  for (const member of members) {
    const now = ratio(
      week.filter(
        (s) => s.userId === member.userId,
      ),
    );

    const before = ratio(
      previous.filter(
        (s) => s.userId === member.userId,
      ),
    );

    const delta = Math.round(
      (now - before) * 100,
    );

    if (
      delta > 0 &&
      (!mostImproved ||
        delta > mostImproved.deltaPoints)
    ) {
      mostImproved = {
        // FIX: displayName is inside the related user object.
        displayName: member.user.displayName,
        deltaPoints: delta,
      };
    }
  }

  // Your own comparison, against your own SYNC history.
  // Nobody else sees it.
  const yourWeek = ratio(
    week.filter(
      (s) => s.userId === userId,
    ),
  );

  const yourTrailing = ratio(
    slots.filter(
      (s) =>
        s.userId === userId &&
        s.key < weekStart,
    ),
  );

  const yourHistory =
    slots.filter(
      (s) =>
        s.userId === userId &&
        s.key < weekStart,
    ).length > 0;

  return {
    thisWeek: Math.round(
      thisWeek * 100,
    ),

    lastWeek: Math.round(
      lastWeek * 100,
    ),

    deltaPoints: Math.round(
      (thisWeek - lastWeek) * 100,
    ),

    qualifyingDays,

    bestDay,

    weakestTask,

    mostImproved,

    members: memberRows.sort(
      (a, b) => b.pct - a.pct,
    ),

    you: {
      thisWeek: Math.round(
        yourWeek * 100,
      ),

      trailing: Math.round(
        yourTrailing * 100,
      ),

      deltaPoints: Math.round(
        (yourWeek - yourTrailing) * 100,
      ),

      hasHistory: yourHistory,
    },
  };
}

/** Final standings, shown once a season has ended. */
export async function seasonSummary(
  syncId: string,
  timezone: string,
) {
  const sync = await db.sync.findUnique({
    where: { id: syncId },
    select: {
      startDate: true,
      endDate: true,
    },
  });

  if (
    !sync?.startDate ||
    !sync.endDate
  ) {
    return null;
  }

  const from = dateToDayKey(
    sync.startDate,
  );

  const to = dateToDayKey(
    sync.endDate,
  );

  const capped =
    to > todayKey(timezone)
      ? todayKey(timezone)
      : to;

  const { slots, members } =
    await loadSlots(
      syncId,
      from,
      capped,
    );

  const standings = members
    .map((member) => {
      const mine = slots.filter(
        (s) =>
          s.userId === member.userId,
      );

      const done = mine.filter(
        (s) => s.done,
      ).length;

      return {
        // FIX: displayName is inside the related user object.
        displayName:
          member.user.displayName,

        done,
        total: mine.length,
        pct:
          mine.length === 0
            ? 0
            : done / mine.length,
      };
    })
    .sort(
      (a, b) => b.pct - a.pct,
    );

  return {
    from,
    to,
    standings,
    totalSlots: slots.length,
  };
}