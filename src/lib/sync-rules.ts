import { localTimeNow, minutesFromHHmm } from "@/lib/time";

/**
 * Pure group rules, kept clear of the database import so they can be unit
 * tested. `src/lib/sync-progress.ts` re-exports them with its queries.
 */

/** 80% of member-task slots. Forgives one person, not two. */
export const GROUP_STREAK_THRESHOLD = 0.8;

/** After this local hour, open shared work counts as at risk. */
export const AT_RISK_AFTER_MINUTE = 18 * 60;

export const MILESTONES = [25, 50, 75, 100] as const;

export function dayQualifies(ratio: number) {
  return ratio >= GROUP_STREAK_THRESHOLD;
}

export function isAtRisk(input: {
  timezone: string;
  scheduledCount: number;
  completedCount: number;
  onRestDay: boolean;
  nowMinutes?: number;
}) {
  if (input.onRestDay) return false;
  if (input.scheduledCount === 0) return false;
  if (input.completedCount >= input.scheduledCount) return false;

  const now = input.nowMinutes ?? minutesFromHHmm(localTimeNow(input.timezone));
  return now >= AT_RISK_AFTER_MINUTE;
}


// ---------------------------------------------------------------- seasons

export type SeasonStatus = "none" | "upcoming" | "active" | "ended";

export type Season = {
  status: SeasonStatus;
  dayNumber: number | null;
  totalDays: number | null;
  daysRemaining: number | null;
};

/** Pure date comparison on day keys, so it is timezone-correct by construction. */
export function seasonStatus(
  startKey: string | null,
  endKey: string | null,
  todayKey: string,
): SeasonStatus {
  if (!startKey && !endKey) return "none";
  if (startKey && todayKey < startKey) return "upcoming";
  if (endKey && todayKey > endKey) return "ended";
  return "active";
}

function daysBetweenKeys(from: string, to: string) {
  const a = Date.parse(`${from}T00:00:00.000Z`);
  const b = Date.parse(`${to}T00:00:00.000Z`);
  return Math.round((b - a) / 86_400_000);
}

export function describeSeason(
  startKey: string | null,
  endKey: string | null,
  todayKey: string,
): Season {
  const status = seasonStatus(startKey, endKey, todayKey);

  if (status === "none") {
    return { status, dayNumber: null, totalDays: null, daysRemaining: null };
  }

  const totalDays = startKey && endKey ? daysBetweenKeys(startKey, endKey) + 1 : null;
  const dayNumber = startKey ? daysBetweenKeys(startKey, todayKey) + 1 : null;
  const daysRemaining = endKey ? Math.max(0, daysBetweenKeys(todayKey, endKey)) : null;

  return {
    status,
    dayNumber: dayNumber !== null && totalDays !== null ? Math.min(dayNumber, totalDays) : dayNumber,
    totalDays,
    daysRemaining,
  };
}

/** Ended seasons are read only: no completions, no new shared tasks. */
export function seasonIsWritable(status: SeasonStatus) {
  return status !== "ended" && status !== "upcoming";
}
