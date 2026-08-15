import { z } from "zod";

import { taskCategory } from "@/lib/validation/task";

export const startFocusSchema = z.object({
  label: z.string().trim().min(1).max(60),
  category: taskCategory,
  taskId: z.string().min(1).nullable(),
  plannedMinutes: z.number().int().min(5).max(240),
});

export const endFocusSchema = z.object({
  id: z.string().min(1),
  elapsedSeconds: z.number().int().min(0).max(60 * 60 * 8),
  completed: z.boolean(),
});
