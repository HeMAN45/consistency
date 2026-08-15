import { describe, expect, it } from "vitest";

import { overlaps, parseTimeRange } from "@/lib/schedule-rules";
import { BACKFILL_DAYS, isWithinBackfillWindow } from "@/lib/backfill";
import { shiftDayKey, todayKey } from "@/lib/time";

describe("time ranges", () => {
  it("rejects a range that ends before it starts", () => {
    expect(parseTimeRange("10:00", "09:00")).toBeNull();
    expect(parseTimeRange("10:00", "10:00")).toBeNull();
  });

  it("parses a valid range into minutes", () => {
    expect(parseTimeRange("08:00", "09:30")).toEqual({ startMinute: 480, endMinute: 570 });
  });
});

describe("overlap detection", () => {
  const existing = [{ id: "a", startMinute: 480, endMinute: 570 }];

  it("allows blocks that only touch", () => {
    expect(overlaps(existing, { startMinute: 570, endMinute: 600 })).toBe(false);
    expect(overlaps(existing, { startMinute: 420, endMinute: 480 })).toBe(false);
  });

  it("catches partial and full overlaps", () => {
    expect(overlaps(existing, { startMinute: 500, endMinute: 600 })).toBe(true);
    expect(overlaps(existing, { startMinute: 400, endMinute: 700 })).toBe(true);
    expect(overlaps(existing, { startMinute: 500, endMinute: 520 })).toBe(true);
  });

  it("ignores the block being edited", () => {
    expect(overlaps(existing, { id: "a", startMinute: 480, endMinute: 600 })).toBe(false);
  });
});

describe("backfill window", () => {
  const tz = "Asia/Kolkata";

  it("accepts today and the edge of the window", () => {
    const today = todayKey(tz);
    expect(isWithinBackfillWindow(today, tz)).toBe(true);
    expect(isWithinBackfillWindow(shiftDayKey(today, -BACKFILL_DAYS), tz)).toBe(true);
  });

  it("rejects older days and the future", () => {
    const today = todayKey(tz);
    expect(isWithinBackfillWindow(shiftDayKey(today, -(BACKFILL_DAYS + 1)), tz)).toBe(false);
    expect(isWithinBackfillWindow(shiftDayKey(today, 1), tz)).toBe(false);
  });
});
