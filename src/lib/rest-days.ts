import { db } from "@/lib/db";
import { dayKeyToDate, dateToDayKey, todayKey, type DayKey } from "@/lib/time";

/**
 * Declared rest days, not streak freezes.
 *
 * Today or any future day can be declared; the past cannot. That keeps the
 * meaningful line intact: you can decide to take a day off, but you cannot
 * reclassify a day you already lost.
 */

export const REST_DAYS_PER_MONTH = 4;

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

  // Today or later. The past stays closed: a day that already happened cannot
  // be reclassified after the fact, which is the whole point of the rule.
  if (key < today) {
    return {
      ok: false,
      error: "Yesterday can't become a rest day. Declare today or a day ahead.",
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
  if (key < today) {
    return { ok: false, error: "That rest day has passed. It stays on the record." };
  }

  await db.restDay.deleteMany({ where: { userId, date: dayKeyToDate(key) } });
  return { ok: true };
}
