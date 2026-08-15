import { shiftDayKey, todayKey, type DayKey } from "@/lib/time";

/**
 * Pure, dependency-free so it can be unit tested without a database.
 * Unlimited backfill would turn a streak into fiction.
 */
export const BACKFILL_DAYS = 7;

export function isWithinBackfillWindow(key: DayKey, timezone: string): boolean {
  const today = todayKey(timezone);
  return key <= today && key >= shiftDayKey(today, -BACKFILL_DAYS);
}
