import type { DayType, TaskCategory } from "@prisma/client";

type Seed = {
  name: string;
  category: TaskCategory;
  dayType: DayType;
  isCore: boolean;
};

/** Seeded at registration, editable immediately (PRD §63). */
export const DEFAULT_TASKS: Seed[] = [
  { name: "Pranayam", category: "HEALTH", dayType: "WEEKDAY", isCore: true },
  { name: "Python / Pandas", category: "ML", dayType: "WEEKDAY", isCore: true },
  { name: "Gym", category: "HEALTH", dayType: "DAILY", isCore: true },
  { name: "SQL lecture + practice", category: "SQL", dayType: "WEEKDAY", isCore: true },
  { name: "DSA lecture", category: "DSA", dayType: "WEEKDAY", isCore: true },
  { name: "DSA problems", category: "DSA", dayType: "WEEKDAY", isCore: true },
  { name: "Diet on track", category: "HEALTH", dayType: "DAILY", isCore: true },

  { name: "Weekly DSA revision", category: "DSA", dayType: "SATURDAY", isCore: true },
  { name: "Redo flagged problems", category: "DSA", dayType: "SATURDAY", isCore: true },

  { name: "LeetCode weekly contest", category: "DSA", dayType: "SUNDAY", isCore: true },
  { name: "Light review", category: "CUSTOM", dayType: "SUNDAY", isCore: false },
];

export function defaultTasksFor(userId: string) {
  return DEFAULT_TASKS.map((task, index) => ({
    ...task,
    ownerUserId: userId,
    createdByUserId: userId,
    sortOrder: index,
  }));
}
