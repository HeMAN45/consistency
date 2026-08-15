import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { addDays, differenceInCalendarDays, parseISO } from "date-fns";
import type { DayType } from "@prisma/client";

/**
 * A "day key" is the user's LOCAL calendar day as `yyyy-MM-dd`.
 *
 * Rule for the whole codebase: never derive a day from a raw UTC instant.
 * A user in Asia/Kolkata logging a task at 01:30 local is still on the
 * previous UTC day, and the streak must not care.
 */
export type DayKey = string;

export function dayKeyFor(instant: Date, timezone: string): DayKey {
  return formatInTimeZone(instant, timezone, "yyyy-MM-dd");
}

export function todayKey(timezone: string): DayKey {
  return dayKeyFor(new Date(), timezone);
}

/**
 * Postgres `date` columns are timezone-free. Prisma reads and writes them as
 * UTC midnight, so a day key must always be converted this exact way.
 */
export function dayKeyToDate(key: DayKey): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

export function dateToDayKey(date: Date): DayKey {
  return date.toISOString().slice(0, 10);
}

export function shiftDayKey(key: DayKey, days: number): DayKey {
  return dateToDayKey(addDays(dayKeyToDate(key), days));
}

export function daysBetween(from: DayKey, to: DayKey): number {
  return differenceInCalendarDays(dayKeyToDate(to), dayKeyToDate(from));
}

/** Inclusive range, oldest first. */
export function dayKeyRange(from: DayKey, to: DayKey): DayKey[] {
  const out: DayKey[] = [];
  for (let i = 0; i <= daysBetween(from, to); i++) out.push(shiftDayKey(from, i));
  return out;
}

/** The last `count` days ending today, oldest first. */
export function recentDayKeys(timezone: string, count: number): DayKey[] {
  const end = todayKey(timezone);
  return dayKeyRange(shiftDayKey(end, -(count - 1)), end);
}

export function dayTypeFor(key: DayKey): DayType {
  const weekday = dayKeyToDate(key).getUTCDay(); // safe: key is already local
  if (weekday === 0) return "SUNDAY";
  if (weekday === 6) return "SATURDAY";
  return "WEEKDAY";
}

/**
 * DAILY applies every day, ONE_OFF applies to its single scheduled date, and
 * the rest apply on their matching weekday.
 */
export function taskAppliesOn(
  task: { dayType: DayType; scheduledDate?: Date | null },
  key: DayKey,
): boolean {
  if (task.dayType === "ONE_OFF") {
    return Boolean(task.scheduledDate) && dateToDayKey(task.scheduledDate as Date) === key;
  }
  return task.dayType === "DAILY" || task.dayType === dayTypeFor(key);
}

// ---------------------------------------------------------------- wake time

export function minutesFromHHmm(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

export function hhmmFromMinutes(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/**
 * A wake-up counts as on time within a grace window after the goal.
 * Waking earlier than the goal always counts.
 */
export const WAKE_GRACE_MINUTES = 15;

export function isWakeOnTime(actual: string, goal: string): boolean {
  return minutesFromHHmm(actual) <= minutesFromHHmm(goal) + WAKE_GRACE_MINUTES;
}

export function localTimeNow(timezone: string): string {
  return formatInTimeZone(new Date(), timezone, "HH:mm");
}

export function formatDayKey(key: DayKey, pattern = "MMM d"): string {
  return formatInTimeZone(dayKeyToDate(key), "UTC", pattern);
}

/** Guards against a user submitting an arbitrary timezone string. */
export function isValidTimezone(tz: string): boolean {
  try {
    toZonedTime(new Date(), tz);
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function isValidDayKey(key: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const parsed = parseISO(key);
  return !Number.isNaN(parsed.getTime());
}
