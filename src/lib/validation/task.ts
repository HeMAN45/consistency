import { z } from "zod";

export const taskCategory = z.enum(["DSA", "SQL", "ML", "HEALTH", "CUSTOM"]);
export const dayType = z.enum(["DAILY", "WEEKDAY", "SATURDAY", "SUNDAY", "ONE_OFF"]);
export const missReason = z.enum([
  "SICK",
  "TRAVEL",
  "OVERLOADED",
  "LOW_ENERGY",
  "CHOSE_NOT_TO",
  "OTHER",
]);

export const createTaskSchema = z
  .object({
    name: z.string().trim().min(1, "Give the task a name").max(60),
    category: taskCategory,
    // Only meaningful for CUSTOM; ignored otherwise so stale text can't linger.
    customLabel: z.string().trim().max(24).nullable().optional(),
    dayType: dayType,
    // The form sends "" when no date applies, so accept it and normalise below.
    scheduledDate: z
      .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date"), z.literal("")])
      .nullable()
      .optional(),
    // Optional reference: a LeetCode problem, a Codeforces question, a doc.
    linkUrl: z
      .union([z.url("Links have to start with http"), z.literal("")])
      .nullable()
      .optional(),
    isCore: z.boolean(),
  })
  .transform((task) => ({
    ...task,
    customLabel: task.category === "CUSTOM" ? (task.customLabel?.trim() || null) : null,
    scheduledDate:
      task.dayType === "ONE_OFF" && task.scheduledDate ? task.scheduledDate : null,
    linkUrl: task.linkUrl ? task.linkUrl : null,
  }))
  .refine((task) => task.dayType !== "ONE_OFF" || Boolean(task.scheduledDate), {
    message: "Pick the date this one-off task belongs to",
  });

export const updateTaskSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().trim().min(1, "Give the task a name").max(60),
    category: taskCategory,
    customLabel: z.string().trim().max(24).nullable().optional(),
    dayType: dayType,
    // The form sends "" when no date applies, so accept it and normalise below.
    scheduledDate: z
      .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date"), z.literal("")])
      .nullable()
      .optional(),
    // Optional reference: a LeetCode problem, a Codeforces question, a doc.
    linkUrl: z
      .union([z.url("Links have to start with http"), z.literal("")])
      .nullable()
      .optional(),
    isCore: z.boolean(),
  })
  .transform((task) => ({
    ...task,
    customLabel: task.category === "CUSTOM" ? (task.customLabel?.trim() || null) : null,
    scheduledDate:
      task.dayType === "ONE_OFF" && task.scheduledDate ? task.scheduledDate : null,
    linkUrl: task.linkUrl ? task.linkUrl : null,
  }))
  .refine((task) => task.dayType !== "ONE_OFF" || Boolean(task.scheduledDate), {
    message: "Pick the date this one-off task belongs to",
  });

export const toggleTaskSchema = z.object({
  taskId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Bad date"),
  completed: z.boolean(),
  evidenceUrl: z.url("Evidence has to be a link").max(500).nullable().optional(),
});

export const reorderSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1).max(200),
});

export const metricsSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Bad date"),
  steps: z.number().int().min(0).max(200000).nullable(),
  wakeTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm")
    .nullable(),
  notes: z.string().trim().max(500).nullable(),
  missReason: missReason.nullable().optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type MetricsInput = z.infer<typeof metricsSchema>;
