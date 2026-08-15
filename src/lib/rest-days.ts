import { db } from "@/lib/db";
import { dayKeyToDate, dateToDayKey, todayKey, type DayKey } from "@/lib/time";

/**
 * Declared rest days, not streak freezes.
 *
 * The distinction the PRD cares about: scheduling Sunday off a week ahead is a
 * plan, and forgiving yesterday is an excuse. So a rest day must be declared at
 * least a full day ahead, and can never be applied retroactively.
 */

export const REST_DAYS_PER_MONTH = 4;
export const MIN_NOTICE_DAYS = 1;

export function monthOf(key: DayKey) {
  return key.slice(0, 7); // yyyy-MM
}

export async function restDaysInMonth(userId: string, key: DayKey) {
  const month = monthOf(key);
  const days = await db.restDay.findMany({
    where: { userId, date: { gte: dayKeyToDate(`${month}-01`) } },
    select: { date: true },
  });
  return days.filter((d) => monthOf(dateToDayKey(d.date)) === month).length;
}

export async function listRestDays(userId: string, from: DayKey, to: DayKey) {
  const days = await db.restDay.findMany({
    where: { userId, date: { gte: dayKeyToDate(from), lte: dayKeyToDate(to) } },
    orderBy: { date: "asc" },
    select: { id: true, date: true, note: true },
  });
  return days.map((d) => ({ id: d.id, date: dateToDayKey(d.date), note: d.note }));
}

export async function restDayKeys(userId: string, from: DayKey, to: DayKey) {
  const days = await listRestDays(userId, from, to);
  return new Set(days.map((d) => d.date));
}

export type DeclareResult =
  | { ok: true }
  | { ok: false; error: string };

export async function declareRestDay(
  userId: string,
  key: DayKey,
  timezone: string,
  note: string | null,
): Promise<DeclareResult> {
  const today = todayKey(timezone);

  // Strictly ahead of time. Today and the past are both refused.
  const earliest = dateToDayKey(new Date(dayKeyToDate(today).getTime() + MIN_NOTICE_DAYS * 86_400_000));
  if (key < earliest) {
    return {
      ok: false,
      error: "Rest days have to be declared at least a day ahead. Yesterday can't become one.",
    };
  }

  const used = await restDaysInMonth(userId, key);
  if (used >= REST_DAYS_PER_MONTH) {
    return { ok: false, error: `That month already has ${REST_DAYS_PER_MONTH} rest days.` };
  }

  const existing = await db.restDay.findUnique({
    where: { userId_date: { userId, date: dayKeyToDate(key) } },
    select: { id: true },
  });
  if (existing) return { ok: false, error: "That day is already a rest day." };

  await db.restDay.create({ data: { userId, date: dayKeyToDate(key), note } });
  return { ok: true };
}

export async function cancelRestDay(
  userId: string,
  key: DayKey,
  timezone: string,
): Promise<DeclareResult> {
  const today = todayKey(timezone);

  // Cancelling a past rest day would rewrite history that already counted.
  if (key <= today) {
    return { ok: false, error: "That rest day has already started. It stays on the record." };
  }

  await db.restDay.deleteMany({ where: { userId, date: dayKeyToDate(key) } });
  return { ok: true };
}
