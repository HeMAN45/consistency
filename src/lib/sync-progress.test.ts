import { describe, expect, it } from "vitest";

import {
  describeSeason,
  GROUP_STREAK_THRESHOLD,
  isAtRisk,
  MILESTONES,
  seasonIsWritable,
  seasonStatus,
} from "@/lib/sync-rules";

describe("group streak threshold", () => {
  it("tolerates one member of five having a bad day", () => {
    // 5 members, 2 tasks = 10 slots. One member missing both leaves 8 of 10.
    expect(8 / 10).toBeGreaterThanOrEqual(GROUP_STREAK_THRESHOLD);
  });

  it("does not tolerate two of five going missing", () => {
    expect(6 / 10).toBeLessThan(GROUP_STREAK_THRESHOLD);
  });
});

describe("at risk", () => {
  // nowMinutes is injected so the test doesn't depend on when it runs.
  const evening = {
    timezone: "UTC",
    scheduledCount: 3,
    completedCount: 1,
    onRestDay: false,
    nowMinutes: 20 * 60,
  };

  it("flags open work in the evening", () => {
    expect(isAtRisk(evening)).toBe(true);
  });

  it("stays quiet earlier in the day", () => {
    expect(isAtRisk({ ...evening, nowMinutes: 9 * 60 })).toBe(false);
  });

  it("never flags a declared rest day", () => {
    expect(isAtRisk({ ...evening, onRestDay: true })).toBe(false);
  });

  it("never flags someone who finished", () => {
    expect(isAtRisk({ ...evening, completedCount: 3 })).toBe(false);
  });

  it("never flags a day with nothing scheduled", () => {
    expect(isAtRisk({ ...evening, scheduledCount: 0, completedCount: 0 })).toBe(false);
  });
});

describe("milestones", () => {
  it("are ordered and end at completion", () => {
    expect([...MILESTONES]).toEqual([25, 50, 75, 100]);
  });
});

describe("seasons", () => {
  it("reports upcoming, active and ended", () => {
    expect(seasonStatus("2026-09-01", "2026-12-01", "2026-08-15")).toBe("upcoming");
    expect(seasonStatus("2026-08-01", "2026-12-01", "2026-08-15")).toBe("active");
    expect(seasonStatus("2026-01-01", "2026-08-14", "2026-08-15")).toBe("ended");
    expect(seasonStatus(null, null, "2026-08-15")).toBe("none");
  });

  it("counts the day you're on inclusively", () => {
    const season = describeSeason("2026-08-01", "2026-08-10", "2026-08-05");
    expect(season.dayNumber).toBe(5);
    expect(season.totalDays).toBe(10);
    expect(season.daysRemaining).toBe(5);
  });

  it("treats the last day as still active", () => {
    expect(seasonStatus("2026-08-01", "2026-08-15", "2026-08-15")).toBe("active");
  });

  it("locks an ended season", () => {
    expect(seasonIsWritable("ended")).toBe(false);
    expect(seasonIsWritable("active")).toBe(true);
    expect(seasonIsWritable("none")).toBe(true);
  });
});
