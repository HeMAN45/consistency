import { describe, expect, it } from "vitest";

import {
  applyRatingDelta,
  bandProgress,
  consistencyScore,
  MAX_RATING,
  momentum,
  RATING_RULES,
  ratingDeltaForDay,
  tierFor,
  TIERS,
  xpForDay,
  xpForFocusSession,
} from "@/lib/rank";

const baseDay = {
  completionPct: 1,
  perfectDay: true,
  stepGoalMet: false,
  wakeGoalMet: false,
  streakBefore: 0,
  hadCoreTasks: true,
};

describe("tiers", () => {
  it("covers the rating range without gaps", () => {
    for (let rating = 0; rating <= 3000; rating += 50) {
      expect(tierFor(rating)).toBeDefined();
    }
  });

  it("puts boundary ratings in the higher tier", () => {
    expect(tierFor(399).label).toBe("Newbie");
    expect(tierFor(400).label).toBe("Pupil");
    expect(tierFor(1199).label).toBe("Specialist");
    expect(tierFor(1200).label).toBe("Expert");
  });

  it("keeps the top tier open-ended", () => {
    expect(tierFor(2200).label).toBe("Grandmaster");
    expect(tierFor(MAX_RATING).label).toBe("Grandmaster");
    expect(bandProgress(MAX_RATING)).toBe(1);
  });

  it("reports band progress inside the current tier only", () => {
    expect(bandProgress(400)).toBe(0);
    expect(bandProgress(600)).toBeCloseTo(0.5);
  });
});

describe("daily rating", () => {
  it("holds steady exactly on the expectation line", () => {
    const delta = ratingDeltaForDay({
      ...baseDay,
      completionPct: RATING_RULES.expectation,
      perfectDay: false,
    });
    expect(delta).toBe(0);
  });

  it("never exceeds the ceiling before bonuses", () => {
    const delta = ratingDeltaForDay({ ...baseDay, perfectDay: false });
    expect(delta).toBeLessThanOrEqual(RATING_RULES.ceiling);
  });

  it("never drops below the floor", () => {
    const delta = ratingDeltaForDay({ ...baseDay, completionPct: 0, perfectDay: false });
    expect(delta).toBe(RATING_RULES.floor);
  });

  it("does not let bonuses rescue a bad day", () => {
    const bad = ratingDeltaForDay({
      ...baseDay,
      completionPct: 0.2,
      perfectDay: false,
      stepGoalMet: true,
      wakeGoalMet: true,
      streakBefore: 30,
    });
    expect(bad).toBeLessThan(0);
  });

  it("treats a day with nothing scheduled as neutral", () => {
    expect(ratingDeltaForDay({ ...baseDay, hadCoreTasks: false })).toBe(0);
  });

  it("caps the streak bonus", () => {
    const long = ratingDeltaForDay({ ...baseDay, streakBefore: 400 });
    const short = ratingDeltaForDay({ ...baseDay, streakBefore: 0 });
    expect(long - short).toBe(RATING_RULES.maxStreakBonus);
  });

  it("clamps the rating to its bounds", () => {
    expect(applyRatingDelta(5, -50)).toBe(0);
    expect(applyRatingDelta(MAX_RATING, 50)).toBe(MAX_RATING);
  });
});

describe("consistency score", () => {
  const day = (completionPct: number) => ({
    completionPct,
    stepGoalMet: false,
    wakeGoalMet: false,
    hadCoreTasks: true,
  });

  it("returns zero with nothing tracked", () => {
    expect(consistencyScore([], 0)).toBe(0);
    expect(consistencyScore([{ ...day(1), hadCoreTasks: false }], 0)).toBe(0);
  });

  it("ignores days with no core tasks rather than counting them as failures", () => {
    const withRestDay = consistencyScore([day(1), { ...day(0), hadCoreTasks: false }], 0);
    expect(withRestDay).toBe(consistencyScore([day(1)], 0));
  });

  it("reaches 100 only when everything lands", () => {
    const perfect = Array.from({ length: 30 }, () => ({
      completionPct: 1,
      stepGoalMet: true,
      wakeGoalMet: true,
      hadCoreTasks: true,
    }));
    expect(consistencyScore(perfect, 21)).toBe(100);
  });

  it("stays inside 0..100", () => {
    const score = consistencyScore([day(1)], 9999);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

describe("momentum", () => {
  const day = (completionPct: number) => ({
    completionPct,
    stepGoalMet: false,
    wakeGoalMet: false,
    hadCoreTasks: true,
  });

  it("reports improvement", () => {
    const days = [...Array(7).fill(day(0.5)), ...Array(7).fill(day(1))];
    const result = momentum(days);
    expect(result.direction).toBe("up");
    expect(result.deltaPoints).toBe(50);
  });

  it("supports decline", () => {
    const days = [...Array(7).fill(day(1)), ...Array(7).fill(day(0.6))];
    expect(momentum(days).direction).toBe("down");
  });

  it("is flat with no history", () => {
    expect(momentum([]).direction).toBe("flat");
  });
});

describe("xp", () => {
  it("adds up the day's sources", () => {
    expect(
      xpForDay({
        coreCompleted: 2,
        bonusCompleted: 1,
        perfectDay: true,
        stepGoalMet: true,
        wakeGoalMet: true,
      }),
    ).toBe(2 * 10 + 5 + 25 + 10 + 10);
  });

  it("awards focus XP only per completed half hour", () => {
    expect(xpForFocusSession(1799)).toBe(0);
    expect(xpForFocusSession(1800)).toBe(10);
    expect(xpForFocusSession(5400)).toBe(30);
  });
});

describe("tier table", () => {
  it("is ordered and contiguous", () => {
    for (let i = 1; i < TIERS.length; i++) {
      expect(TIERS[i].min).toBe(TIERS[i - 1].max);
    }
  });
});
