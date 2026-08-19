import { z } from "zod";
import { isValidTimezone } from "@/lib/time";

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Username needs at least 3 characters")
  .max(24, "Username can be at most 24 characters")
  .regex(/^[a-z0-9_.-]+$/, "Letters, numbers, dots, hyphens and underscores");

/**
 * Length is the only rule. Character-class requirements push people toward
 * "Password1!" and away from a long passphrase, which is the weaker of the two.
 * Anything you can type is accepted: capitals, symbols, spaces, emoji.
 */
export const passwordSchema = z
  .string()
  .min(8, "Password needs at least 8 characters")
  .max(128, "Password can be at most 128 characters");

export const registerSchema = z.object({
  username: usernameSchema,
  displayName: z.string().trim().min(1, "Add a display name").max(40),
  password: passwordSchema,
  email: z.email("Enter a valid email").optional().or(z.literal("")),
  timezone: z
    .string()
    .default("Asia/Kolkata")
    .refine(isValidTimezone, "Unknown timezone"),
});

export const loginSchema = z.object({
  username: usernameSchema,
  password: z.string().min(1, "Enter your password"),
});

export const settingsSchema = z.object({
  displayName: z.string().trim().min(1).max(40),
  timezone: z.string().refine(isValidTimezone, "Unknown timezone"),
  stepGoal: z.number().int().min(1000).max(50000),
  wakeGoalTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm"),
  email: z.email("Enter a valid email").nullable(),
  reminderEnabled: z.boolean(),
  allowNudges: z.boolean(),
  reminderTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
