import type { DayType, TaskCategory } from "@prisma/client";

/**
 * Labels only. This module must never import the database.
 *
 * Client components need these strings, and any module they import gets bundled
 * for the browser. Keeping them beside the Prisma queries pulled the whole
 * client into the bundle and crashed the page.
 */

export const CATEGORY_LABELS: Record<TaskCategory, string> = {
  DSA: "DSA",
  SQL: "SQL",
  ML: "ML",
  HEALTH: "Health",
  CUSTOM: "Custom",
};

export const DAY_TYPE_LABELS: Record<DayType, string> = {
  DAILY: "Every day",
  WEEKDAY: "Weekdays",
  SATURDAY: "Saturdays",
  SUNDAY: "Sundays",
  ONE_OFF: "One day only",
};

/** What the user sees for a category: their own word when they gave one. */
export function categoryLabel(task: {
  category: TaskCategory;
  customLabel?: string | null;
}) {
  return task.category === "CUSTOM" && task.customLabel
    ? task.customLabel
    : CATEGORY_LABELS[task.category];
}
