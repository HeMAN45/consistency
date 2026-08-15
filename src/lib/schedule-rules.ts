import { minutesFromHHmm } from "@/lib/time";

/**
 * Pure scheduling rules, kept free of the database import so they can be unit
 * tested. `src/lib/schedule.ts` re-exports them alongside its queries.
 */

export function parseTimeRange(start: string, end: string) {
  const startMinute = minutesFromHHmm(start);
  const endMinute = minutesFromHHmm(end);
  if (Number.isNaN(startMinute) || Number.isNaN(endMinute)) return null;
  if (endMinute <= startMinute) return null;
  return { startMinute, endMinute };
}

/** Blocks may touch but not overlap — a plan that double-books isn't a plan. */
export function overlaps(
  entries: { startMinute: number; endMinute: number; id?: string }[],
  candidate: { startMinute: number; endMinute: number; id?: string },
) {
  return entries.some(
    (entry) =>
      entry.id !== candidate.id &&
      candidate.startMinute < entry.endMinute &&
      entry.startMinute < candidate.endMinute,
  );
}
