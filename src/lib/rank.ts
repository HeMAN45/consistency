import type { RankTier } from "@prisma/client";
import { clamp } from "@/lib/utils";

/**
 * SINGLE SOURCE OF TRUTH for progression.
 *
 * Rating is the only thing that decides a tier. XP is a separate cumulative
 * effort counter and can never promote a user on its own — that resolves the
 * tension between PRD §25 (rank from consistency) and §28 (an XP bar under the
 * rank). The bar shown under the badge is rating progress through the current
 * band; XP is displayed beside it as lifetime effort.
 */

export type TierDef = {
  tier: RankTier;
  label: string;
  min: number;
  max: number; // exclusive, Infinity for the top tier
  color: string; // CSS custom property name
};

export const TIERS: TierDef[] = [
  { tier: "NEWBIE", label: "Newbie", min: 0, max: 400, color: "--color-rank-newbie" },
  { tier: "PUPIL", label: "Pupil", min: 400, max: 800, color: "--color-rank-pupil" },
  { tier: "SPECIALIST", label: "Specialist", min: 800, max: 1200, color: "--color-rank-specialist" },
  { tier: "EXPERT", label: "Expert", min: 1200, max: 1600, color: "--color-rank-expert" },
  { tier: "CANDIDATE_MASTER", label: "Candidate Master", min: 1600, max: 1900, color: "--color-rank-cm" },
  { tier: "MASTER", label: "Master", min: 1900, max: 2200, color: "--color-rank-master" },
  { tier: "GRANDMASTER", label: "Grandmaster", min: 2200, max: Infinity, color: "--color-rank-gm" },
];

export const MAX_RATING = 3000;

export function tierFor(rating: number): TierDef {
  return TIERS.find((t) => rating >= t.min && rating < t.max) ?? TIERS[TIERS.length - 1];
}

export function nextTier(rating: number): TierDef | null {
  const index = TIERS.indexOf(tierFor(rating));
  return TIERS[index + 1] ?? null;
}

/** 0..1 progress through the current band. */
export function bandProgress(rating: number): number {
  const t = tierFor(rating);
  if (t.max === Infinity) return 1;
  return clamp((rating - t.min) / (t.max - t.min), 0, 1);
}

export function ratingToNextTier(rating: number): number | null {
  const next = nextTier(rating);
  return next ? Math.max(0, next.min - rating) : null;
}

// ---------------------------------------------------------------- daily rating

export type DayPerformance = {
  /** Core-task completion for the day, 0..1. */
  completionPct: number;
  /** True only when every core task scheduled for the day is done. */
  perfectDay: boolean;
  stepGoalMet: boolean;
  wakeGoalMet: boolean;
  /** Streak length going into the day. */
  streakBefore: number;
  /** False when the day had no core tasks scheduled at all (rest day). */
  hadCoreTasks: boolean;
};

/**
 * Rating moves against a 70% expectation line: hit 70% and you hold, beat it
 * and you climb, miss it and you fall. Deliberately legible — a user should be
 * able to explain their own delta (PRD §31).
 */
export const RATING_RULES = {
  expectation: 0.7,
  slope: 40,
  floor: -20,
  ceiling: 20,
  perfectDay: 5,
  stepGoal: 2,
  wakeGoal: 3,
  streakBonusPerWeek: 1,
  maxStreakBonus: 3,
} as const;

export function ratingDeltaForDay(day: DayPerformance): number {
  // A day with nothing scheduled is neutral, not a punishment.
  if (!day.hadCoreTasks) return 0;

  const base = clamp(
    Math.round((day.completionPct - RATING_RULES.expectation) * RATING_RULES.slope),
    RATING_RULES.floor,
    RATING_RULES.ceiling,
  );

  let bonus = 0;
  if (day.perfectDay) bonus += RATING_RULES.perfectDay;
  if (day.stepGoalMet) bonus += RATING_RULES.stepGoal;
  if (day.wakeGoalMet) bonus += RATING_RULES.wakeGoal;

  // Bonuses reward a good day; they never rescue a bad one.
  if (base < 0) return base;

  const streakBonus = Math.min(
    Math.floor(day.streakBefore / 7) * RATING_RULES.streakBonusPerWeek,
    RATING_RULES.maxStreakBonus,
  );

  return base + bonus + streakBonus;
}

export function applyRatingDelta(current: number, delta: number): number {
  return clamp(current + delta, 0, MAX_RATING);
}

// ---------------------------------------------------------------- xp

export const XP_RULES = {
  coreTask: 10,
  bonusTask: 5,
  perfectDay: 25,
  stepGoal: 10,
  wakeGoal: 10,
  focusSessionPerHalfHour: 10,
  syncGoalMilestone: 25,
} as const;

export function xpForDay(input: {
  coreCompleted: number;
  bonusCompleted: number;
  perfectDay: boolean;
  stepGoalMet: boolean;
  wakeGoalMet: boolean;
}): number {
  return (
    input.coreCompleted * XP_RULES.coreTask +
    input.bonusCompleted * XP_RULES.bonusTask +
    (input.perfectDay ? XP_RULES.perfectDay : 0) +
    (input.stepGoalMet ? XP_RULES.stepGoal : 0) +
    (input.wakeGoalMet ? XP_RULES.wakeGoal : 0)
  );
}

export function xpForFocusSession(elapsedSeconds: number): number {
  return Math.floor(elapsedSeconds / 1800) * XP_RULES.focusSessionPerHalfHour;
}

// ---------------------------------------------------------------- scores

export type ScoreInput = {
  completionPct: number;
  stepGoalMet: boolean;
  wakeGoalMet: boolean;
  hadCoreTasks: boolean;
};

export const CONSISTENCY_WEIGHTS = {
  completion: 60,
  steps: 15,
  wake: 15,
  streak: 10,
  streakTargetDays: 21,
} as const;

/**
 * 0–100 over a trailing window (30 days by default). Every component is
 * explainable in one sentence, which is the point of PRD §31.
 */
export function consistencyScore(days: ScoreInput[], currentStreak: number): number {
  const scored = days.filter((d) => d.hadCoreTasks);
  if (scored.length === 0) return 0;

  const mean = (fn: (d: ScoreInput) => number) =>
    scored.reduce((sum, d) => sum + fn(d), 0) / scored.length;

  const completion = mean((d) => clamp(d.completionPct, 0, 1)) * CONSISTENCY_WEIGHTS.completion;
  const steps = mean((d) => (d.stepGoalMet ? 1 : 0)) * CONSISTENCY_WEIGHTS.steps;
  const wake = mean((d) => (d.wakeGoalMet ? 1 : 0)) * CONSISTENCY_WEIGHTS.wake;
  const streak =
    clamp(currentStreak / CONSISTENCY_WEIGHTS.streakTargetDays, 0, 1) * CONSISTENCY_WEIGHTS.streak;

  return Math.round(completion + steps + wake + streak);
}

export type Momentum = {
  /** Percentage-point change between the two windows. */
  deltaPoints: number;
  recentPct: number;
  previousPct: number;
  direction: "up" | "down" | "flat";
};

/** Compares the last 7 scored days against the 7 before them. */
export function momentum(days: ScoreInput[], window = 7): Momentum {
  const avg = (slice: ScoreInput[]) => {
    const scored = slice.filter((d) => d.hadCoreTasks);
    if (!scored.length) return 0;
    return scored.reduce((s, d) => s + clamp(d.completionPct, 0, 1), 0) / scored.length;
  };

  const recent = avg(days.slice(-window));
  const previous = avg(days.slice(-window * 2, -window));
  const deltaPoints = Math.round((recent - previous) * 100);

  return {
    deltaPoints,
    recentPct: Math.round(recent * 100),
    previousPct: Math.round(previous * 100),
    direction: deltaPoints > 1 ? "up" : deltaPoints < -1 ? "down" : "flat",
  };
}

/** Comeback mode runs for three days after a streak of 3+ is broken. */
export const COMEBACK_DAYS = 3;
