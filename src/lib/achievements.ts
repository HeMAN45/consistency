import { db } from "@/lib/db";

/**
 * Achievements are derived, never incremented. Every rule is a question asked
 * of stored rows, so a replay of history can't inflate them and a bug can't
 * award something the data doesn't support.
 */

export type UnlockedAchievement = { code: string; name: string; description: string };

type Facts = {
  perfectDays: number;
  longestStreak: number;
  currentStreak: number;
  dsaDays: number;
  gymSessions: number;
  onTimeWakeUps: number;
  stepGoalDays: number;
  longestFocusSeconds: number;
};

const RULES: { code: string; met: (f: Facts) => boolean }[] = [
  { code: "FIRST_BLOOD", met: (f) => f.perfectDays >= 1 },
  { code: "IRON_WEEK", met: (f) => f.longestStreak >= 7 },
  { code: "NO_EXCUSES", met: (f) => f.longestStreak >= 30 },
  { code: "CODE_WARRIOR", met: (f) => f.dsaDays >= 30 },
  { code: "FORGED", met: (f) => f.gymSessions >= 50 },
  { code: "BEFORE_SUNRISE", met: (f) => f.onTimeWakeUps >= 20 },
  { code: "THE_GRIND", met: (f) => f.perfectDays >= 100 },
  { code: "TEN_K_CLUB", met: (f) => f.stepGoalDays >= 30 },
  { code: "DEEP_WORK", met: (f) => f.longestFocusSeconds >= 7200 },
  {
    // Broke something substantial, then rebuilt a real streak on top of it.
    code: "RELENTLESS",
    met: (f) => f.longestStreak >= 14 && f.currentStreak >= 7 && f.currentStreak < f.longestStreak,
  },
];

async function gatherFacts(userId: string): Promise<Facts> {
  const [user, perfectDays, stepGoalDays, onTimeWakeUps, dsaLogs, gymLogs, focus] =
    await Promise.all([
      db.user.findUnique({
        where: { id: userId },
        select: { longestStreak: true, currentStreak: true },
      }),
      db.dailySnapshot.count({ where: { userId, perfectDay: true } }),
      db.dailySnapshot.count({ where: { userId, stepGoalMet: true } }),
      db.dailyMetric.count({ where: { userId, wokeUpOnTime: true } }),
      db.taskLog.findMany({
        where: { userId, completed: true, task: { category: "DSA" } },
        select: { date: true },
        distinct: ["date"],
      }),
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
    ]);

  return {
    perfectDays,
    longestStreak: user?.longestStreak ?? 0,
    currentStreak: user?.currentStreak ?? 0,
    dsaDays: dsaLogs.length,
    gymSessions: gymLogs,
    onTimeWakeUps,
    stepGoalDays,
    longestFocusSeconds: focus._max.elapsedSeconds ?? 0,
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
