import type { Task } from "@prisma/client";

import { db } from "@/lib/db";
import { dayKeyFor, dayKeyToDate, taskAppliesOn, type DayKey } from "@/lib/time";

export type DayTask = Task & { completed: boolean; evidenceUrl: string | null };

/** Tasks scheduled for a given day, with that day's completion state attached. */
export async function tasksForDay(
  userId: string,
  key: DayKey,
  timezone: string,
): Promise<DayTask[]> {
  const [tasks, logs] = await Promise.all([
    db.task.findMany({
      where: { ownerUserId: userId, isActive: true, archivedAt: null },
      orderBy: [{ isCore: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    db.taskLog.findMany({ where: { userId, date: dayKeyToDate(key) } }),
  ]);

  const completed = new Set(logs.filter((l) => l.completed).map((l) => l.taskId));
  const evidence = new Map(logs.map((l) => [l.taskId, l.evidenceUrl]));

  return tasks
    .filter((task) => dayKeyFor(task.createdAt, timezone) <= key)
    .filter((task) => taskAppliesOn(task, key))
    .map((task) => ({
      ...task,
      completed: completed.has(task.id),
      evidenceUrl: evidence.get(task.id) ?? null,
    }));
}

/** Everything the user owns, archived included, for the Tasks screen. */
export function allTasks(userId: string) {
  return db.task.findMany({
    where: { ownerUserId: userId },
    orderBy: [{ archivedAt: "asc" }, { isCore: "desc" }, { sortOrder: "asc" }],
  });
}

export const CATEGORY_LABELS: Record<Task["category"], string> = {
  DSA: "DSA",
  SQL: "SQL",
  ML: "ML",
  HEALTH: "Health",
  CUSTOM: "Custom",
};

/** What the user sees for a category: their own word when they gave one. */
export function categoryLabel(task: { category: Task["category"]; customLabel?: string | null }) {
  return task.category === "CUSTOM" && task.customLabel
    ? task.customLabel
    : CATEGORY_LABELS[task.category];
}

export const DAY_TYPE_LABELS: Record<Task["dayType"], string> = {
  DAILY: "Every day",
  WEEKDAY: "Weekdays",
  SATURDAY: "Saturdays",
  SUNDAY: "Sundays",
  ONE_OFF: "One day only",
};
