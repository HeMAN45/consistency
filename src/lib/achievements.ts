import { db } from "@/lib/db";

/**
 * Achievements are derived, never incremented. Every rule is a question asked
 * of stored rows, so a replay of history can't inflate them and a bug can't
 * award something the data doesn't support.
 */

export type UnlockedAchievement = { code: string; name: string; description: string };

type Facts = {
  perfectDays: number;
  daysTracked: number;
  longestStreak: number;
  currentStreak: number;
  dsaDays: number;
  sqlDays: number;
  mlDays: number;
  gymSessions: number;
  onTimeWakeUps: number;
  stepGoalDays: number;
  longestFocusSeconds: number;
  focusSessions: number;
  focusSeconds: number;
  videosWatched: number;
  mostVideosInADay: number;
  playlistsFinished: number;
  syncsJoined: number;
  syncTasksDone: number;
  missReasonsNamed: number;
  restDaysDeclared: number;
  problemsSolved: number;
  hardSolved: number;
  platformsSolved: number;
  problemDays: number;
};

const RULES: { code: string; met: (f: Facts) => boolean }[] = [
  { code: "FIRST_BLOOD", met: (f) => f.perfectDays >= 1 },
  { code: "FIRST_WEEK", met: (f) => f.daysTracked >= 7 },
  { code: "IRON_WEEK", met: (f) => f.longestStreak >= 7 },
  { code: "STEADY", met: (f) => f.longestStreak >= 14 },
  { code: "NO_EXCUSES", met: (f) => f.longestStreak >= 30 },
  { code: "THE_GRIND", met: (f) => f.perfectDays >= 100 },
  { code: "CENTURION", met: (f) => f.daysTracked >= 100 },

  { code: "CODE_WARRIOR", met: (f) => f.dsaDays >= 30 },
  { code: "QUERY_MASTER", met: (f) => f.sqlDays >= 30 },
  { code: "MODEL_CITIZEN", met: (f) => f.mlDays >= 30 },
  { code: "FORGED", met: (f) => f.gymSessions >= 50 },

  { code: "BEFORE_SUNRISE", met: (f) => f.onTimeWakeUps >= 20 },
  { code: "DAWN_PATROL", met: (f) => f.onTimeWakeUps >= 100 },
  { code: "TEN_K_CLUB", met: (f) => f.stepGoalDays >= 30 },
  { code: "ON_FOOT", met: (f) => f.stepGoalDays >= 100 },

  { code: "DEEP_WORK", met: (f) => f.longestFocusSeconds >= 7200 },
  { code: "IN_THE_ZONE", met: (f) => f.focusSessions >= 25 },
  { code: "TWENTY_HOURS", met: (f) => f.focusSeconds >= 20 * 3600 },

  { code: "STUDENT", met: (f) => f.videosWatched >= 25 },
  { code: "COURSE_CLEARED", met: (f) => f.playlistsFinished >= 1 },
  { code: "BINGE_CONTROL", met: (f) => f.mostVideosInADay >= 5 },

  { code: "FIRST_SOLVE", met: (f) => f.problemsSolved >= 1 },
  { code: "TEN_DOWN", met: (f) => f.problemsSolved >= 10 },
  { code: "FIFTY_SOLVED", met: (f) => f.problemsSolved >= 50 },
  { code: "HUNDRED_SOLVED", met: (f) => f.problemsSolved >= 100 },
  { code: "FIVE_HUNDRED_SOLVED", met: (f) => f.problemsSolved >= 500 },
  { code: "HARD_EARNED", met: (f) => f.hardSolved >= 25 },
  { code: "WELL_ROUNDED", met: (f) => f.platformsSolved >= 3 },
  { code: "DAILY_GRIND", met: (f) => f.problemDays >= 30 },

  { code: "NOT_ALONE", met: (f) => f.syncsJoined >= 1 },
  { code: "TEAM_PLAYER", met: (f) => f.syncTasksDone >= 50 },

  {
    // Broke something substantial, then rebuilt a real streak on top of it.
    code: "RELENTLESS",
    met: (f) => f.longestStreak >= 14 && f.currentStreak >= 7 && f.currentStreak < f.longestStreak,
  },
  // Facing a miss honestly is a habit worth naming, even though naming it
  // changes no number anywhere.
  { code: "HONEST_RECKONING", met: (f) => f.missReasonsNamed >= 10 },
  { code: "PLANNED_REST", met: (f) => f.restDaysDeclared >= 5 },
];

async function categoryDays(userId: string, category: "DSA" | "SQL" | "ML") {
  const logs = await db.taskLog.findMany({
    where: { userId, completed: true, task: { category } },
    select: { date: true },
    distinct: ["date"],
  });
  return logs.length;
}

async function gatherFacts(userId: string): Promise<Facts> {
  const [user, perfectDays, daysTracked, stepGoalDays, onTimeWakeUps, dsaDays, sqlDays, mlDays, gymLogs, focus, focusStats, watched, finishedPlaylists, syncsJoined, syncTasksDone, missReasons, restDays, solvedPersonal, solvedShared] =
    await Promise.all([
      db.user.findUnique({
        where: { id: userId },
        select: { longestStreak: true, currentStreak: true },
      }),
      db.dailySnapshot.count({ where: { userId, perfectDay: true } }),
      db.dailySnapshot.count({ where: { userId, coreTotal: { gt: 0 } } }),
      db.dailySnapshot.count({ where: { userId, stepGoalMet: true } }),
      db.dailyMetric.count({ where: { userId, wokeUpOnTime: true } }),
      categoryDays(userId, "DSA"),
      categoryDays(userId, "SQL"),
      categoryDays(userId, "ML"),
      db.taskLog.count({
        where: {
          userId,
          completed: true,
          task: { category: "HEALTH", name: { contains: "gym", mode: "insensitive" } },
        },
      }),
      db.focusSession.aggregate({
        where: { userId, completed: true },
        _max: { elapsedSeconds: true },
      }),
      db.focusSession.aggregate({
        where: { userId, completed: true },
        _count: { _all: true },
        _sum: { elapsedSeconds: true },
      }),
      db.taskLog.findMany({
        where: { userId, completed: true, task: { youtubeVideoId: { not: null } } },
        select: { date: true },
      }),
      db.youtubePlaylist.findMany({
        where: { ownerUserId: userId },
        select: { id: true, videos: { select: { id: true, available: true } } },
      }),
      db.syncMembership.count({ where: { userId, status: "ACCEPTED" } }),
      db.syncTaskLog.count({ where: { userId, completed: true } }),
      db.dailyMetric.count({ where: { userId, missReason: { not: null } } }),
      db.restDay.count({ where: { userId } }),
      // Solved problems arrive through tasks, personal or shared, so both are
      // counted and a problem solved in a SYNC counts exactly the same.
      db.task.findMany({
        where: {
          ownerUserId: userId,
          problemId: { not: null },
          logs: { some: { userId, completed: true } },
        },
        select: {
          problemId: true,
          logs: { where: { userId, completed: true }, select: { date: true } },
          problem: { select: { platform: true, difficulty: true } },
        },
      }),
      db.syncTask.findMany({
        where: { problemId: { not: null }, logs: { some: { userId, completed: true } } },
        select: {
          problemId: true,
          logs: { where: { userId, completed: true }, select: { date: true } },
          problem: { select: { platform: true, difficulty: true } },
        },
      }),
    ]);

  const solvedProblems = [...solvedPersonal, ...solvedShared].filter((task) => task.problem);
  const uniqueProblems = new Map(solvedProblems.map((task) => [task.problemId, task.problem!]));
  const solveDays = new Set(
    solvedProblems.flatMap((task) => task.logs.map((log) => log.date.toISOString().slice(0, 10))),
  );

  // Videos watched per day, for the "five in a day" rule.
  const perDay = new Map<string, number>();
  for (const log of watched) {
    const key = log.date.toISOString().slice(0, 10);
    perDay.set(key, (perDay.get(key) ?? 0) + 1);
  }

  // A playlist counts as finished when every available video has a completed
  // task or recorded prior progress.
  const playlistVideoIds = finishedPlaylists.flatMap((playlist) =>
    playlist.videos.filter((video) => video.available).map((video) => video.id),
  );

  const [videoTasksDone, priorDone] = await Promise.all([
    db.task.findMany({
      where: {
        ownerUserId: userId,
        youtubeVideoId: { in: playlistVideoIds },
        logs: { some: { userId, completed: true } },
      },
      select: { youtubeVideoId: true },
    }),
    db.watchProgress.findMany({
      where: { userId, videoId: { in: playlistVideoIds }, completedAt: { not: null } },
      select: { videoId: true },
    }),
  ]);

  const doneVideoIds = new Set<string | null>([
    ...videoTasksDone.map((task) => task.youtubeVideoId),
    ...priorDone.map((row) => row.videoId),
  ]);

  const playlistsFinished = finishedPlaylists.filter((playlist) => {
    const usable = playlist.videos.filter((video) => video.available);
    return usable.length > 0 && usable.every((video) => doneVideoIds.has(video.id));
  }).length;

  return {
    perfectDays,
    daysTracked,
    longestStreak: user?.longestStreak ?? 0,
    currentStreak: user?.currentStreak ?? 0,
    dsaDays,
    sqlDays,
    mlDays,
    gymSessions: gymLogs,
    onTimeWakeUps,
    stepGoalDays,
    longestFocusSeconds: focus._max.elapsedSeconds ?? 0,
    focusSessions: focusStats._count._all ?? 0,
    focusSeconds: focusStats._sum.elapsedSeconds ?? 0,
    videosWatched: watched.length,
    mostVideosInADay: perDay.size === 0 ? 0 : Math.max(...perDay.values()),
    playlistsFinished,
    syncsJoined,
    syncTasksDone,
    missReasonsNamed: missReasons,
    restDaysDeclared: restDays,
    problemsSolved: uniqueProblems.size,
    hardSolved: [...uniqueProblems.values()].filter((problem) => problem.difficulty === "HARD")
      .length,
    platformsSolved: new Set([...uniqueProblems.values()].map((problem) => problem.platform)).size,
    problemDays: solveDays.size,
  };
}

/** Returns only what was newly unlocked on this call, for the celebration UI. */
export async function evaluateAchievements(userId: string): Promise<UnlockedAchievement[]> {
  const [facts, catalogue, existing] = await Promise.all([
    gatherFacts(userId),
    db.achievement.findMany(),
    db.userAchievement.findMany({ where: { userId }, select: { achievementId: true } }),
  ]);

  const owned = new Set(existing.map((u) => u.achievementId));
  const byCode = new Map(catalogue.map((a) => [a.code, a]));
  const unlocked: UnlockedAchievement[] = [];

  for (const rule of RULES) {
    const achievement = byCode.get(rule.code);
    if (!achievement || owned.has(achievement.id)) continue;
    if (!rule.met(facts)) continue;

    // Unique constraint makes this safe against concurrent recomputes.
    await db.userAchievement
      .create({ data: { userId, achievementId: achievement.id } })
      .then(() =>
        unlocked.push({
          code: achievement.code,
          name: achievement.name,
          description: achievement.description,
        }),
      )
      .catch(() => undefined);
  }

  return unlocked;
}

export async function listAchievements(userId: string) {
  const [catalogue, owned] = await Promise.all([
    db.achievement.findMany({ orderBy: { sortOrder: "asc" } }),
    db.userAchievement.findMany({ where: { userId } }),
  ]);

  const unlockedAt = new Map(owned.map((u) => [u.achievementId, u.unlockedAt]));

  return catalogue.map((a) => ({
    ...a,
    unlockedAt: unlockedAt.get(a.id) ?? null,
  }));
}
