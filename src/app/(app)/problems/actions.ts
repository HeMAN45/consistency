"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { addProblems, scheduleProblem, solveProblem } from "@/lib/problems";
import { normaliseTopics } from "@/lib/problem-urls";
import { recomputeDay } from "@/lib/progression";
import { requireUser } from "@/lib/session";
import { todayKey } from "@/lib/time";

export type ProblemState = { error?: string; ok?: boolean; message?: string };

const addSchema = z.object({
  raw: z.string().trim().min(1).max(20000),
  syncId: z.string().nullable().optional(),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).nullable().optional(),
  topics: z.string().max(200).optional(),
  scheduleToday: z.boolean().optional(),
});

export async function addProblemsAction(input: unknown): Promise<ProblemState> {
  const user = await requireUser();
  const parsed = addSchema.safeParse(input);
  if (!parsed.success) return { error: "Paste at least one link." };

  const count = await db.problem.count({ where: { ownerUserId: user.id } });
  if (count >= 2000) return { error: "That's a lot of problems. Clear some out first." };

  const result = await addProblems({
    raw: parsed.data.raw,
    ownerUserId: user.id,
    syncId: parsed.data.syncId || null,
    difficulty: parsed.data.difficulty ?? null,
    topics: normaliseTopics(parsed.data.topics ?? ""),
    scheduleToday: parsed.data.scheduleToday ?? false,
    todayKey: todayKey(user.timezone),
  });

  if ("error" in result && result.error) return { error: result.error };

  revalidatePath("/problems");
  revalidatePath("/dashboard");
  if (parsed.data.syncId) revalidatePath(`/sync/${parsed.data.syncId}`);

  const added = "added" in result ? result.added : 0;
  const skipped = "skipped" in result ? result.skipped : 0;

  return {
    ok: true,
    message:
      skipped > 0
        ? `Added ${added}. Skipped ${skipped} already saved.`
        : `Added ${added}.`,
  };
}

export async function solveProblemAction(problemId: string): Promise<ProblemState> {
  const user = await requireUser();

  const result = await solveProblem(problemId, user.id, user.timezone);
  if ("error" in result && result.error) return { error: result.error };

  // Solving is a completed task, so the rating has to be recomputed for today.
  await recomputeDay(user.id, todayKey(user.timezone));

  revalidatePath("/problems");
  revalidatePath("/dashboard");
  revalidatePath("/analytics");
  return { ok: true };
}

const updateSchema = z.object({
  problemId: z.string().min(1),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).nullable(),
  topics: z.string().max(200),
});

export async function updateProblemAction(input: unknown): Promise<ProblemState> {
  const user = await requireUser();
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { error: "Bad request." };

  const problem = await db.problem.findUnique({
    where: { id: parsed.data.problemId },
    select: { ownerUserId: true, syncId: true },
  });
  if (!problem) return { error: "Problem not found." };

  // Tags on a SYNC problem belong to the room, so only its own owner edits them.
  if (problem.ownerUserId !== user.id) {
    return { error: "That problem belongs to a SYNC. Edit it there." };
  }

  await db.problem.update({
    where: { id: parsed.data.problemId },
    data: {
      difficulty: parsed.data.difficulty,
      topics: normaliseTopics(parsed.data.topics),
    },
  });

  revalidatePath("/problems");
  return { ok: true };
}

export async function removeProblemAction(problemId: string): Promise<ProblemState> {
  const user = await requireUser();

  const problem = await db.problem.findUnique({
    where: { id: problemId },
    select: { ownerUserId: true },
  });
  if (!problem || problem.ownerUserId !== user.id) return { error: "Problem not found." };

  await db.problem.delete({ where: { id: problemId } });

  revalidatePath("/problems");
  return { ok: true };
}


/** Puts an existing problem on today's board without solving it. */
export async function scheduleProblemAction(problemId: string): Promise<ProblemState> {
  const user = await requireUser();

  const result = await scheduleProblem(problemId, user.id, todayKey(user.timezone));
  if ("error" in result && result.error) return { error: result.error };

  revalidatePath("/problems");
  revalidatePath("/dashboard");
  return { ok: true, message: "Added to today." };
}
