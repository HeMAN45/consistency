"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { recomputeFrom } from "@/lib/progression";
import { xpForFocusSession } from "@/lib/rank";
import { requireUser } from "@/lib/session";
import { todayKey } from "@/lib/time";
import { endFocusSchema, startFocusSchema } from "@/lib/validation/focus";

export async function startFocusAction(input: unknown) {
  const user = await requireUser();
  const parsed = startFocusSchema.safeParse(input);
  if (!parsed.success) return { error: "Check the session details." };

  if (parsed.data.taskId) {
    const task = await db.task.findUnique({
      where: { id: parsed.data.taskId },
      select: { ownerUserId: true },
    });
    if (!task || task.ownerUserId !== user.id) return { error: "Task not found." };
  }

  const session = await db.focusSession.create({
    data: { ...parsed.data, userId: user.id },
    select: { id: true },
  });

  return { ok: true, id: session.id };
}

export async function endFocusAction(input: unknown) {
  const user = await requireUser();
  const parsed = endFocusSchema.safeParse(input);
  if (!parsed.success) return { error: "Bad request." };

  const session = await db.focusSession.findUnique({
    where: { id: parsed.data.id },
    select: { userId: true, endedAt: true },
  });
  if (!session || session.userId !== user.id) return { error: "Session not found." };
  if (session.endedAt) return { error: "That session already ended." };

  // XP is earned per completed half hour, so a 12-minute session earns nothing.
  const xpAwarded = parsed.data.completed ? xpForFocusSession(parsed.data.elapsedSeconds) : 0;

  await db.focusSession.update({
    where: { id: parsed.data.id },
    data: {
      elapsedSeconds: parsed.data.elapsedSeconds,
      completed: parsed.data.completed,
      endedAt: new Date(),
      xpAwarded,
    },
  });

  // Focus XP feeds the user total, which is aggregated by the progression engine.
  await recomputeFrom(user.id, todayKey(user.timezone));

  revalidatePath("/focus");
  revalidatePath("/dashboard");
  return { ok: true, xpAwarded };
}
