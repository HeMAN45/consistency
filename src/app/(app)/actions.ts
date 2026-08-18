"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import {
  BACKFILL_DAYS,
  isWithinBackfillWindow,
  recomputeDay,
  recomputeFrom,
} from "@/lib/progression";
import { requireUser } from "@/lib/session";
import { dayKeyToDate, isWakeOnTime, shiftDayKey, todayKey } from "@/lib/time";
import { TIERS } from "@/lib/rank";
import { settingsSchema } from "@/lib/validation/auth";

const TIER_LABELS = Object.fromEntries(TIERS.map((t) => [t.tier, t.label])) as Record<
  string,
  string
>;
import {
  createTaskSchema,
  metricsSchema,
  reorderSchema,
  toggleTaskSchema,
  updateTaskSchema,
} from "@/lib/validation/task";

export type ProgressEvents = {
  perfectDay?: boolean;
  rankUp?: { from: string; to: string };
  unlocked?: { code: string; name: string; description: string }[];
};

export type ActionState = { error?: string; ok?: boolean; events?: ProgressEvents };

/**
 * Every action re-reads the session and checks ownership against the database.
 * The client is never trusted for who owns what.
 */

export async function toggleTaskAction(input: unknown): Promise<ActionState> {
  const user = await requireUser();
  const parsed = toggleTaskSchema.safeParse(input);
  if (!parsed.success) return { error: "Bad request." };

  const { taskId, date, completed, evidenceUrl } = parsed.data;

  if (!isWithinBackfillWindow(date, user.timezone)) {
    return { error: "You can only log the last 7 days." };
  }

  const task = await db.task.findUnique({
    where: { id: taskId },
    select: { ownerUserId: true, isActive: true, archivedAt: true },
  });

  if (!task || task.ownerUserId !== user.id) return { error: "Task not found." };
  if (!task.isActive || task.archivedAt) return { error: "That task is archived." };

  await db.taskLog.upsert({
    where: { taskId_userId_date: { taskId, userId: user.id, date: dayKeyToDate(date) } },
    update: {
      completed,
      completedAt: completed ? new Date() : null,
      // Unticking clears the proof along with the claim.
      evidenceUrl: completed ? (evidenceUrl ?? undefined) : null,
    },
    create: {
      taskId,
      userId: user.id,
      date: dayKeyToDate(date),
      completed,
      completedAt: completed ? new Date() : null,
      evidenceUrl: completed ? (evidenceUrl ?? null) : null,
    },
  });

  const result = await recomputeDay(user.id, date);

  revalidatePath("/dashboard");
  revalidatePath("/analytics");

  return {
    ok: true,
    events: {
      perfectDay: result?.today?.perfectDay ?? false,
      rankUp: result?.promoted
        ? { from: TIER_LABELS[result.previousTier], to: TIER_LABELS[result.tier] }
        : undefined,
      unlocked: result?.unlocked?.length ? result.unlocked : undefined,
    },
  };
}

export async function saveMetricsAction(input: unknown): Promise<ActionState> {
  const user = await requireUser();
  const parsed = metricsSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the values." };

  const { date, steps, wakeTime, notes, missReason } = parsed.data;

  if (!isWithinBackfillWindow(date, user.timezone)) {
    return { error: "You can only log the last 7 days." };
  }

  const stepGoalMet = steps !== null && steps >= user.stepGoal;
  const wokeUpOnTime = wakeTime !== null && isWakeOnTime(wakeTime, user.wakeGoalTime);

  await db.dailyMetric.upsert({
    where: { userId_date: { userId: user.id, date: dayKeyToDate(date) } },
    // missReason is recorded for the user's own review only. It is deliberately
    // absent from every rating input: a reason is not an excuse.
    update: { steps, wakeTime, notes, stepGoalMet, wokeUpOnTime, missReason: missReason ?? null },
    create: {
      userId: user.id,
      date: dayKeyToDate(date),
      steps,
      wakeTime,
      notes,
      stepGoalMet,
      wokeUpOnTime,
      missReason: missReason ?? null,
    },
  });

  const result = await recomputeDay(user.id, date);

  revalidatePath("/dashboard");
  revalidatePath("/analytics");

  return {
    ok: true,
    events: {
      rankUp: result?.promoted
        ? { from: TIER_LABELS[result.previousTier], to: TIER_LABELS[result.tier] }
        : undefined,
      unlocked: result?.unlocked?.length ? result.unlocked : undefined,
    },
  };
}

export async function createTaskAction(input: unknown): Promise<ActionState> {
  const user = await requireUser();
  const parsed = createTaskSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };

  /*
   * The cap exists to stop a runaway recurring task list, so it counts only
   * recurring habits. One-off tasks, and the dated video tasks a playlist
   * generates, are transient by nature: a 100-video course would otherwise eat
   * the entire allowance and block you from adding a habit.
   */
  const count = await db.task.count({
    where: {
      ownerUserId: user.id,
      archivedAt: null,
      dayType: { not: "ONE_OFF" },
      youtubeVideoId: null,
    },
  });

  if (count >= 60) {
    return { error: "60 recurring tasks is the limit. Archive one first." };
  }

  const last = await db.task.findFirst({
    where: { ownerUserId: user.id },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  await db.task.create({
    data: {
      ...parsed.data,
      scheduledDate: parsed.data.scheduledDate ? dayKeyToDate(parsed.data.scheduledDate) : null,
      ownerUserId: user.id,
      createdByUserId: user.id,
      sortOrder: (last?.sortOrder ?? 0) + 1,
    },
  });

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateTaskAction(input: unknown): Promise<ActionState> {
  const user = await requireUser();
  const parsed = updateTaskSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };

  const { id, scheduledDate, ...data } = parsed.data;

  const existing = await db.task.findUnique({ where: { id }, select: { ownerUserId: true } });
  if (!existing || existing.ownerUserId !== user.id) return { error: "Task not found." };

  await db.task.update({
    where: { id },
    data: { ...data, scheduledDate: scheduledDate ? dayKeyToDate(scheduledDate) : null },
  });

  // Changing core/bonus or the day type changes what "complete" meant today.
  await recomputeDay(user.id, todayKey(user.timezone));

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function archiveTaskAction(taskId: string, archived: boolean): Promise<ActionState> {
  const user = await requireUser();

  const existing = await db.task.findUnique({
    where: { id: taskId },
    select: { ownerUserId: true },
  });
  if (!existing || existing.ownerUserId !== user.id) return { error: "Task not found." };

  // Archive, never delete — history stays intact (PRD §13).
  await db.task.update({
    where: { id: taskId },
    data: { archivedAt: archived ? new Date() : null, isActive: !archived },
  });

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function reorderTasksAction(input: unknown): Promise<ActionState> {
  const user = await requireUser();
  const parsed = reorderSchema.safeParse(input);
  if (!parsed.success) return { error: "Bad request." };

  const owned = await db.task.findMany({
    where: { id: { in: parsed.data.orderedIds }, ownerUserId: user.id },
    select: { id: true },
  });

  const ownedIds = new Set(owned.map((t) => t.id));
  if (ownedIds.size !== parsed.data.orderedIds.length) return { error: "Task not found." };

  await db.$transaction(
    parsed.data.orderedIds.map((id, index) =>
      db.task.update({ where: { id }, data: { sortOrder: index } }),
    ),
  );

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateSettingsAction(input: unknown): Promise<ActionState> {
  const user = await requireUser();
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the values." };

  // Reminders need somewhere to go.
  if (parsed.data.reminderEnabled && !parsed.data.email) {
    return { error: "Add an email address to receive reminders." };
  }

  try {
    await db.user.update({ where: { id: user.id }, data: parsed.data });
  } catch {
    return { error: "That email is already used by another account." };
  }

  // Step and wake goals feed the rating, and the timezone redefines "today",
  // so replay the backfill window rather than just recomputing one day.
  const today = todayKey(parsed.data.timezone);
  await recomputeFrom(user.id, shiftDayKey(today, -BACKFILL_DAYS));

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { ok: true };
}


export async function tagMissedDayAction(
  date: string,
  reason: string | null,
): Promise<ActionState> {
  const user = await requireUser();

  const { missReason } = await import("@/lib/validation/task");
  const parsed = reason === null ? { success: true, data: null } : missReason.safeParse(reason);
  if (!parsed.success) return { error: "Unknown reason." };

  if (!isWithinBackfillWindow(date, user.timezone)) {
    return { error: "That day is outside the 7-day window." };
  }

  // Only the reason is touched. Steps, wake time and notes stay as they are,
  // and nothing here reaches the rating engine.
  await db.dailyMetric.upsert({
    where: { userId_date: { userId: user.id, date: dayKeyToDate(date) } },
    update: { missReason: (parsed.data as never) ?? null },
    create: {
      userId: user.id,
      date: dayKeyToDate(date),
      missReason: (parsed.data as never) ?? null,
    },
  });

  revalidatePath("/dashboard");
  return { ok: true };
}

// ------------------------------------------------------------- rest days

export async function declareRestDayAction(
  date: string,
  note: string | null,
): Promise<ActionState> {
  const user = await requireUser();
  const { declareRestDay } = await import("@/lib/rest-days");

  const result = await declareRestDay(user.id, date, user.timezone, note);
  if (!result.ok) return { error: result.error };

  await recomputeFrom(user.id, todayKey(user.timezone));

  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function cancelRestDayAction(date: string): Promise<ActionState> {
  const user = await requireUser();
  const { cancelRestDay } = await import("@/lib/rest-days");

  const result = await cancelRestDay(user.id, date, user.timezone);
  if (!result.ok) return { error: result.error };

  revalidatePath("/calendar");
  return { ok: true };
}
