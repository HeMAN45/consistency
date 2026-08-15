"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { isWithinBackfillWindow } from "@/lib/progression";
import { overlaps, parseTimeRange, scheduleForDay } from "@/lib/schedule";
import { requireUser } from "@/lib/session";
import { dayKeyToDate, isValidDayKey, todayKey } from "@/lib/time";

export type ScheduleState = { error?: string; ok?: boolean };

const blockSchema = z.object({
  date: z.string().refine(isValidDayKey, "Bad date"),
  title: z.string().trim().min(1, "Give the block a title").max(60),
  start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm"),
  end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm"),
  taskId: z.string().nullable(),
});

export async function createBlockAction(input: unknown): Promise<ScheduleState> {
  const user = await requireUser();
  const parsed = blockSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };

  const { date, title, start, end, taskId } = parsed.data;

  const range = parseTimeRange(start, end);
  if (!range) return { error: "The end time has to be after the start." };

  // Planning ahead is fine; the past is limited to the backfill window.
  const today = todayKey(user.timezone);
  if (date < today && !isWithinBackfillWindow(date, user.timezone)) {
    return { error: "That day is too far back to edit." };
  }

  if (taskId) {
    const task = await db.task.findUnique({
      where: { id: taskId },
      select: { ownerUserId: true },
    });
    if (!task || task.ownerUserId !== user.id) return { error: "Task not found." };
  }

  const existing = await scheduleForDay(user.id, date);
  if (overlaps(existing, range)) return { error: "That overlaps a block already on this day." };

  await db.scheduleBlock.create({
    data: {
      userId: user.id,
      date: dayKeyToDate(date),
      title,
      startMinute: range.startMinute,
      endMinute: range.endMinute,
      taskId,
    },
  });

  revalidatePath("/calendar");
  return { ok: true };
}

export async function deleteBlockAction(id: string): Promise<ScheduleState> {
  const user = await requireUser();

  const block = await db.scheduleBlock.findUnique({
    where: { id },
    select: { userId: true, source: true },
  });

  if (!block || block.userId !== user.id) return { error: "Block not found." };
  if (block.source === "IMPORTED") {
    return { error: "Imported blocks are read-only. Remove it in the source calendar." };
  }

  await db.scheduleBlock.delete({ where: { id } });

  revalidatePath("/calendar");
  return { ok: true };
}
