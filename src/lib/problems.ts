import type { Difficulty, Platform } from "@prisma/client";

import { db } from "@/lib/db";
import { requireMembership } from "@/lib/sync";
import { dateToDayKey, dayKeyToDate, recentDayKeys, todayKey, type DayKey } from "@/lib/time";
import { parseProblemList } from "@/lib/problem-urls";

/**
 * Problems are solved through the task system, not a flag of their own. That
 * way a problem solved alone and one solved inside a SYNC arrive at the same
 * place, and solving one moves your rating exactly like any other task.
 */

export type StoredProblem = {
  id: string;
  url: string;
  platform: Platform;
  title: string;
  difficulty: Difficulty | null;
  topics: string[];
  solved: boolean;
  solvedOn: DayKey | null;
  scheduledFor: DayKey | null;
  syncName: string | null;
};

/**
 * Creates the task that makes a problem visible. Personal problems become a
 * one-off task for today; SYNC problems become shared work the whole room can
 * see, which is why they are scheduled the moment they are added rather than
 * when somebody happens to solve one.
 */
export async function scheduleProblem(problemId: string, userId: string, today: DayKey) {
  const problem = await db.problem.findUnique({
    where: { id: problemId },
    select: { id: true, title: true, url: true, ownerUserId: true, syncId: true },
  });
  if (!problem) return { error: "Problem not found." };

  if (problem.syncId) {
    const existing = await db.syncTask.findFirst({
      where: { syncId: problem.syncId, problemId: problem.id },
      select: { id: true },
    });
    if (existing) return { ok: true };

    const last = await db.syncTask.findFirst({
      where: { syncId: problem.syncId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    await db.syncTask.create({
      data: {
        name: problem.title.slice(0, 60),
        category: "DSA",
        dayType: "ONE_OFF",
        scheduledDate: dayKeyToDate(today),
        linkUrl: problem.url,
        problemId: problem.id,
        syncId: problem.syncId,
        createdByUserId: userId,
        isCore: false,
        sortOrder: (last?.sortOrder ?? 0) + 1,
      },
    });

    return { ok: true };
  }

  if (problem.ownerUserId !== userId) return { error: "Problem not found." };

  const existing = await db.task.findFirst({
    where: { ownerUserId: userId, problemId: problem.id, archivedAt: null },
    select: { id: true },
  });
  if (existing) return { ok: true };

  const last = await db.task.findFirst({
    where: { ownerUserId: userId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  await db.task.create({
    data: {
      name: problem.title.slice(0, 60),
      category: "DSA",
      dayType: "ONE_OFF",
      scheduledDate: dayKeyToDate(today),
      linkUrl: problem.url,
      problemId: problem.id,
      ownerUserId: userId,
      createdByUserId: userId,
      // Bonus, so a problem added on a whim can't break a perfect day.
      isCore: false,
      sortOrder: (last?.sortOrder ?? 0) + 1,
    },
  });

  return { ok: true };
}

export async function addProblems(input: {
  raw: string;
  ownerUserId: string;
  syncId?: string | null;
  difficulty?: Difficulty | null;
  topics: string[];
  scheduleToday?: boolean;
  todayKey: DayKey;
}) {
  const parsed = parseProblemList(input.raw);
  if (parsed.length === 0) return { error: "No usable links in that." };
  if (parsed.length > 100) return { error: "100 links at a time is the limit." };

  if (input.syncId) {
    const access = await requireMembership(input.syncId, input.ownerUserId);
    if (!access) return { error: "SYNC not found." };
  }

  let added = 0;
  let skipped = 0;

  for (const problem of parsed) {
    const existing = await db.problem.findFirst({
      where: input.syncId
        ? { syncId: input.syncId, url: problem.url }
        : { ownerUserId: input.ownerUserId, url: problem.url },
      select: { id: true },
    });

    if (existing) {
      skipped += 1;
      continue;
    }

    const created = await db.problem.create({
      data: {
        url: problem.url,
        platform: problem.platform,
        title: problem.title,
        difficulty: input.difficulty ?? null,
        topics: input.topics,
        ownerUserId: input.syncId ? null : input.ownerUserId,
        syncId: input.syncId ?? null,
      },
      select: { id: true },
    });

    // A SYNC problem is shared work: it appears for everyone immediately.
    // A personal one waits to be asked for, unless you asked on the way in.
    if (input.syncId || input.scheduleToday) {
      await scheduleProblem(created.id, input.ownerUserId, input.todayKey);
    }

    added += 1;
  }

  return { added, skipped };
}

export async function listProblems(userId: string, timezone: string): Promise<StoredProblem[]> {
  const [mine, syncOnes] = await Promise.all([
    db.problem.findMany({
      where: { ownerUserId: userId },
      orderBy: { createdAt: "desc" },
    }),
    db.problem.findMany({
      where: { sync: { members: { some: { userId, status: "ACCEPTED" } } } },
      orderBy: { createdAt: "desc" },
      include: { sync: { select: { name: true } } },
    }),
  ]);

  const ids = [...mine.map((p) => p.id), ...syncOnes.map((p) => p.id)];
  if (ids.length === 0) return [];

  const [tasks, syncTasks] = await Promise.all([
    db.task.findMany({
      where: { ownerUserId: userId, problemId: { in: ids } },
      select: {
        problemId: true,
        scheduledDate: true,
        logs: { where: { userId, completed: true }, select: { date: true } },
      },
    }),
    db.syncTask.findMany({
      where: { problemId: { in: ids } },
      select: {
        problemId: true,
        scheduledDate: true,
        logs: { where: { userId, completed: true }, select: { date: true } },
      },
    }),
  ]);

  const state = new Map<string, { solvedOn: DayKey | null; scheduledFor: DayKey | null }>();

  for (const task of [...tasks, ...syncTasks]) {
    if (!task.problemId) continue;
    const solvedLog = task.logs[0];
    const previous = state.get(task.problemId);

    state.set(task.problemId, {
      solvedOn: solvedLog ? dateToDayKey(solvedLog.date) : (previous?.solvedOn ?? null),
      scheduledFor: task.scheduledDate
        ? dateToDayKey(task.scheduledDate)
        : (previous?.scheduledFor ?? null),
    });
  }

  const shape = (problem: (typeof mine)[number], syncName: string | null): StoredProblem => {
    const entry = state.get(problem.id);
    return {
      id: problem.id,
      url: problem.url,
      platform: problem.platform,
      title: problem.title,
      difficulty: problem.difficulty,
      topics: problem.topics,
      solved: Boolean(entry?.solvedOn),
      solvedOn: entry?.solvedOn ?? null,
      scheduledFor: entry?.scheduledFor ?? null,
      syncName,
    };
  };

  return [
    ...mine.map((problem) => shape(problem, null)),
    ...syncOnes.map((problem) => shape(problem, problem.sync?.name ?? null)),
  ];
}

/** Creates or finds today's task for a problem, then marks it done. */
export async function solveProblem(problemId: string, userId: string, timezone: string) {
  const problem = await db.problem.findUnique({
    where: { id: problemId },
    select: { id: true, title: true, url: true, ownerUserId: true, syncId: true },
  });

  if (!problem) return { error: "Problem not found." };

  if (problem.syncId) {
    const access = await requireMembership(problem.syncId, userId);
    if (!access) return { error: "You're not in that SYNC." };
  } else if (problem.ownerUserId !== userId) {
    return { error: "Problem not found." };
  }

  const today = todayKey(timezone);

  // SYNC problems complete through the shared task, so every member's solve is
  // recorded against the same piece of work.
  if (problem.syncId) {
    let syncTask = await db.syncTask.findFirst({
      where: { syncId: problem.syncId, problemId: problem.id },
      select: { id: true },
    });

    if (!syncTask) {
      syncTask = await db.syncTask.create({
        data: {
          name: problem.title.slice(0, 60),
          category: "DSA",
          dayType: "ONE_OFF",
          scheduledDate: dayKeyToDate(today),
          linkUrl: problem.url,
          problemId: problem.id,
          syncId: problem.syncId,
          createdByUserId: userId,
          isCore: false,
        },
        select: { id: true },
      });
    }

    await db.syncTaskLog.upsert({
      where: {
        syncTaskId_userId_date: {
          syncTaskId: syncTask.id,
          userId,
          date: dayKeyToDate(today),
        },
      },
      update: { completed: true, completedAt: new Date() },
      create: {
        syncTaskId: syncTask.id,
        userId,
        date: dayKeyToDate(today),
        completed: true,
        completedAt: new Date(),
      },
    });

    return { ok: true, syncId: problem.syncId };
  }

  let task = await db.task.findFirst({
    where: { ownerUserId: userId, problemId: problem.id },
    select: { id: true },
  });

  if (!task) {
    const last = await db.task.findFirst({
      where: { ownerUserId: userId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    task = await db.task.create({
      data: {
        name: problem.title.slice(0, 60),
        category: "DSA",
        dayType: "ONE_OFF",
        scheduledDate: dayKeyToDate(today),
        linkUrl: problem.url,
        problemId: problem.id,
        ownerUserId: userId,
        createdByUserId: userId,
        // Problems you add ad hoc shouldn't silently threaten a perfect day.
        isCore: false,
        sortOrder: (last?.sortOrder ?? 0) + 1,
      },
      select: { id: true },
    });
  }

  await db.taskLog.upsert({
    where: { taskId_userId_date: { taskId: task.id, userId, date: dayKeyToDate(today) } },
    update: { completed: true, completedAt: new Date() },
    create: {
      taskId: task.id,
      userId,
      date: dayKeyToDate(today),
      completed: true,
      completedAt: new Date(),
    },
  });

  return { ok: true, date: today };
}

export type ProblemStats = {
  total: number;
  solved: number;
  byPlatform: { platform: Platform; solved: number; total: number }[];
  byDifficulty: { difficulty: Difficulty; solved: number }[];
  byTopic: { topic: string; solved: number }[];
  lastSevenDays: { date: DayKey; solved: number }[];
  thisWeek: number;
  lastWeek: number;
};

export async function problemStats(userId: string, timezone: string): Promise<ProblemStats> {
  const problems = await listProblems(userId, timezone);
  const solved = problems.filter((problem) => problem.solved);

  const platforms = new Map<Platform, { solved: number; total: number }>();
  for (const problem of problems) {
    const entry = platforms.get(problem.platform) ?? { solved: 0, total: 0 };
    entry.total += 1;
    if (problem.solved) entry.solved += 1;
    platforms.set(problem.platform, entry);
  }

  const difficulties = new Map<Difficulty, number>();
  for (const problem of solved) {
    if (!problem.difficulty) continue;
    difficulties.set(problem.difficulty, (difficulties.get(problem.difficulty) ?? 0) + 1);
  }

  const topics = new Map<string, number>();
  for (const problem of solved) {
    for (const topic of problem.topics) {
      topics.set(topic, (topics.get(topic) ?? 0) + 1);
    }
  }

  const days = recentDayKeys(timezone, 7);
  const solvedPerDay = new Map<DayKey, number>();
  for (const problem of solved) {
    if (!problem.solvedOn) continue;
    solvedPerDay.set(problem.solvedOn, (solvedPerDay.get(problem.solvedOn) ?? 0) + 1);
  }

  const weekKeys = new Set(recentDayKeys(timezone, 7));
  const previousKeys = new Set(recentDayKeys(timezone, 14));
  for (const key of weekKeys) previousKeys.delete(key);

  return {
    total: problems.length,
    solved: solved.length,
    byPlatform: [...platforms.entries()]
      .map(([platform, counts]) => ({ platform, ...counts }))
      .sort((a, b) => b.solved - a.solved),
    byDifficulty: (["EASY", "MEDIUM", "HARD"] as Difficulty[])
      .map((difficulty) => ({ difficulty, solved: difficulties.get(difficulty) ?? 0 }))
      .filter((entry) => entry.solved > 0),
    byTopic: [...topics.entries()]
      .map(([topic, count]) => ({ topic, solved: count }))
      .sort((a, b) => b.solved - a.solved)
      .slice(0, 8),
    lastSevenDays: days.map((date) => ({ date, solved: solvedPerDay.get(date) ?? 0 })),
    thisWeek: solved.filter((problem) => problem.solvedOn && weekKeys.has(problem.solvedOn)).length,
    lastWeek: solved.filter((problem) => problem.solvedOn && previousKeys.has(problem.solvedOn))
      .length,
  };
}
