"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { areFriends } from "@/lib/friends";
import { isWithinBackfillWindow } from "@/lib/progression";
import { requireUser } from "@/lib/session";
import { refreshGoalProgress, requireMembership } from "@/lib/sync";
import { dayKeyToDate, todayKey } from "@/lib/time";
import { appUrl, emailConfigured, sendEmail } from "@/lib/email";
import { evaluateMilestones } from "@/lib/sync-progress";
import { describeSeason, seasonIsWritable } from "@/lib/sync-rules";
import { dateToDayKey } from "@/lib/time";
import { usernameSchema } from "@/lib/validation/auth";
import { taskCategory, dayType } from "@/lib/validation/task";

export type SocialState = {
  error?: string;
  ok?: boolean;
  message?: string;
  milestone?: number;
};

// ---------------------------------------------------------------- friends

export async function sendFriendRequestAction(rawUsername: unknown): Promise<SocialState> {
  const user = await requireUser();
  const parsed = usernameSchema.safeParse(rawUsername);
  if (!parsed.success) return { error: "Enter a valid username." };

  const target = await db.user.findUnique({
    where: { username: parsed.data },
    select: { id: true },
  });

  if (!target) return { error: "No account with that username." };
  if (target.id === user.id) return { error: "That's you." };

  const existing = await db.friendship.findFirst({
    where: {
      OR: [
        { requesterId: user.id, addresseeId: target.id },
        { requesterId: target.id, addresseeId: user.id },
      ],
    },
    select: { id: true, status: true, requesterId: true },
  });

  if (existing?.status === "ACCEPTED") return { error: "You're already friends." };
  if (existing?.status === "PENDING") {
    return existing.requesterId === user.id
      ? { error: "Request already sent." }
      : { error: "They've already sent you a request — answer it below." };
  }

  if (existing) {
    // A previous rejection can be retried rather than leaving a dead row.
    await db.friendship.update({
      where: { id: existing.id },
      data: { status: "PENDING", requesterId: user.id, addresseeId: target.id, respondedAt: null },
    });
  } else {
    await db.friendship.create({
      data: { requesterId: user.id, addresseeId: target.id, status: "PENDING" },
    });
  }

  revalidatePath("/friends");
  return { ok: true, message: "Request sent." };
}

export async function respondFriendRequestAction(
  friendshipId: string,
  accept: boolean,
): Promise<SocialState> {
  const user = await requireUser();

  const friendship = await db.friendship.findUnique({
    where: { id: friendshipId },
    select: { addresseeId: true, status: true },
  });

  // Only the addressee can answer, and only while it's pending.
  if (!friendship || friendship.addresseeId !== user.id) return { error: "Request not found." };
  if (friendship.status !== "PENDING") return { error: "That request was already answered." };

  await db.friendship.update({
    where: { id: friendshipId },
    data: { status: accept ? "ACCEPTED" : "REJECTED", respondedAt: new Date() },
  });

  revalidatePath("/friends");
  return { ok: true, message: accept ? "Friend added." : "Request declined." };
}

export async function removeFriendshipAction(friendshipId: string): Promise<SocialState> {
  const user = await requireUser();

  const friendship = await db.friendship.findUnique({
    where: { id: friendshipId },
    select: { requesterId: true, addresseeId: true },
  });

  if (!friendship || (friendship.requesterId !== user.id && friendship.addresseeId !== user.id)) {
    return { error: "Not found." };
  }

  await db.friendship.delete({ where: { id: friendshipId } });

  revalidatePath("/friends");
  return { ok: true, message: "Removed." };
}

// ------------------------------------------------------------------- sync

const createSyncSchema = z.object({
  name: z.string().trim().min(1, "Name the SYNC").max(48),
  goalTitle: z.string().trim().min(1, "Give it a shared goal").max(60),
  target: z.number().int().min(1).max(1000),
  endDate: z
    .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")])
    .nullable()
    .optional(),
  inviteUserIds: z.array(z.string()).max(20),
});

export async function createSyncAction(input: unknown): Promise<SocialState & { id?: string }> {
  const user = await requireUser();
  const parsed = createSyncSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };

  const { name, goalTitle, target, endDate, inviteUserIds } = parsed.data;
  const startKey = todayKey(user.timezone);

  // You can only pull in people who already accepted you as a friend.
  const invitable: string[] = [];
  for (const id of inviteUserIds) {
    if (await areFriends(user.id, id)) invitable.push(id);
  }

  const sync = await db.$transaction(async (tx) => {
    const created = await tx.sync.create({
      data: {
        name,
        ownerUserId: user.id,
        startDate: dayKeyToDate(startKey),
        endDate: endDate ? dayKeyToDate(endDate) : null,
      },
      select: { id: true },
    });

    const goal = await tx.syncGoal.create({
      data: {
        syncId: created.id,
        title: goalTitle,
        defaultTarget: target,
        startDate: dayKeyToDate(todayKey(user.timezone)),
      },
      select: { id: true },
    });

    await tx.syncMembership.create({
      data: { syncId: created.id, userId: user.id, status: "ACCEPTED", respondedAt: new Date() },
    });

    await tx.syncGoalProgress.create({
      data: { goalId: goal.id, userId: user.id, memberTarget: target },
    });

    if (invitable.length > 0) {
      await tx.syncMembership.createMany({
        data: invitable.map((id) => ({
          syncId: created.id,
          userId: id,
          status: "INVITED" as const,
          invitedByUserId: user.id,
        })),
      });
    }

    return created;
  });

  revalidatePath("/sync");
  return { ok: true, id: sync.id };
}

export async function respondSyncInviteAction(
  membershipId: string,
  accept: boolean,
): Promise<SocialState> {
  const user = await requireUser();

  const membership = await db.syncMembership.findUnique({
    where: { id: membershipId },
    select: { userId: true, status: true, syncId: true },
  });

  if (!membership || membership.userId !== user.id) return { error: "Invite not found." };
  if (membership.status !== "INVITED") return { error: "That invite was already answered." };

  await db.syncMembership.update({
    where: { id: membershipId },
    data: { status: accept ? "ACCEPTED" : "DECLINED", respondedAt: new Date() },
  });

  if (accept) {
    const goal = await db.syncGoal.findFirst({
      where: { syncId: membership.syncId },
      orderBy: { createdAt: "asc" },
    });
    if (goal) {
      await db.syncGoalProgress.upsert({
        where: { goalId_userId: { goalId: goal.id, userId: user.id } },
        update: {},
        create: { goalId: goal.id, userId: user.id, memberTarget: goal.defaultTarget },
      });
    }
  }

  revalidatePath("/sync");
  return { ok: true, message: accept ? "Joined." : "Declined." };
}

export async function inviteToSyncAction(syncId: string, username: unknown): Promise<SocialState> {
  const user = await requireUser();
  const parsed = usernameSchema.safeParse(username);
  if (!parsed.success) return { error: "Enter a valid username." };

  const access = await requireMembership(syncId, user.id);
  if (!access) return { error: "SYNC not found." };
  if (!access.isOwner) return { error: "Only the creator can invite people." };

  const target = await db.user.findUnique({
    where: { username: parsed.data },
    select: { id: true },
  });
  if (!target) return { error: "No account with that username." };
  if (!(await areFriends(user.id, target.id))) {
    return { error: "You can only invite friends. Add them first." };
  }

  const existing = await db.syncMembership.findUnique({
    where: { syncId_userId: { syncId, userId: target.id } },
    select: { id: true, status: true },
  });

  if (existing?.status === "ACCEPTED") return { error: "They're already in." };
  if (existing?.status === "INVITED") return { error: "Already invited." };

  if (existing) {
    await db.syncMembership.update({
      where: { id: existing.id },
      data: { status: "INVITED", invitedByUserId: user.id, invitedAt: new Date(), leftAt: null },
    });
  } else {
    await db.syncMembership.create({
      data: { syncId, userId: target.id, status: "INVITED", invitedByUserId: user.id },
    });
  }

  revalidatePath(`/sync/${syncId}`);
  return { ok: true, message: "Invited." };
}

export async function leaveSyncAction(syncId: string): Promise<SocialState> {
  const user = await requireUser();

  const access = await requireMembership(syncId, user.id);
  if (!access) return { error: "SYNC not found." };
  if (access.isOwner) return { error: "The creator can't leave. Archive the SYNC instead." };

  await db.syncMembership.update({
    where: { syncId_userId: { syncId, userId: user.id } },
    data: { status: "LEFT", leftAt: new Date() },
  });

  revalidatePath("/sync");
  return { ok: true, message: "You left the SYNC." };
}

export async function removeMemberAction(syncId: string, memberId: string): Promise<SocialState> {
  const user = await requireUser();

  const access = await requireMembership(syncId, user.id);
  if (!access) return { error: "SYNC not found." };
  if (!access.isOwner) return { error: "Only the creator can remove members." };
  if (memberId === user.id) return { error: "You can't remove yourself." };

  await db.syncMembership.update({
    where: { syncId_userId: { syncId, userId: memberId } },
    data: { status: "REMOVED", leftAt: new Date() },
  });

  revalidatePath(`/sync/${syncId}`);
  return { ok: true, message: "Member removed." };
}

const createSyncTaskSchema = z
  .object({
    syncId: z.string().min(1),
    name: z.string().trim().min(1, "Name the task").max(60),
    category: taskCategory,
    dayType,
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
  .refine((task) => task.dayType !== "ONE_OFF" || Boolean(task.scheduledDate), {
    message: "Pick the date this one-off task belongs to",
  });

export async function createSyncTaskAction(input: unknown): Promise<SocialState> {
  const user = await requireUser();
  const parsed = createSyncTaskSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };

  // Any accepted member can propose shared work — a SYNC is a shared space,
  // not the creator's task list.
  const access = await requireMembership(parsed.data.syncId, user.id);
  if (!access) return { error: "SYNC not found." };

  if (!(await seasonAllowsWrites(parsed.data.syncId, user.timezone))) {
    return { error: "This season is closed. No new shared tasks." };
  }

  const count = await db.syncTask.count({
    where: { syncId: parsed.data.syncId, archivedAt: null },
  });
  if (count >= 20) return { error: "20 shared tasks is the limit. Archive one first." };

  const last = await db.syncTask.findFirst({
    where: { syncId: parsed.data.syncId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const { scheduledDate, linkUrl, ...taskData } = parsed.data;
  const oneOffDate = scheduledDate ? scheduledDate : null;

  await db.syncTask.create({
    data: {
      ...taskData,
      scheduledDate: oneOffDate ? dayKeyToDate(oneOffDate) : null,
      linkUrl: linkUrl ? linkUrl : null,
      createdByUserId: user.id,
      sortOrder: (last?.sortOrder ?? 0) + 1,
    },
  });

  revalidatePath(`/sync/${parsed.data.syncId}`);
  return { ok: true };
}

export async function archiveSyncTaskAction(taskId: string): Promise<SocialState> {
  const user = await requireUser();

  const task = await db.syncTask.findUnique({
    where: { id: taskId },
    select: { syncId: true, createdByUserId: true },
  });
  if (!task) return { error: "Task not found." };

  const access = await requireMembership(task.syncId, user.id);
  if (!access) return { error: "SYNC not found." };

  // You can remove what you added; the creator can remove anything.
  if (!access.isOwner && task.createdByUserId !== user.id) {
    return { error: "Only the person who added it, or the SYNC creator, can remove it." };
  }

  await db.syncTask.update({
    where: { id: taskId },
    data: { archivedAt: new Date(), isActive: false },
  });

  revalidatePath(`/sync/${task.syncId}`);
  return { ok: true };
}

const toggleSyncTaskSchema = z.object({
  syncTaskId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  completed: z.boolean(),
});

/**
 * A member can only ever write their own log row. The userId comes from the
 * session and is never accepted from the client, so one member cannot tick a
 * box for another (PRD §15, §49).
 */
export async function toggleSyncTaskAction(input: unknown): Promise<SocialState> {
  const user = await requireUser();
  const parsed = toggleSyncTaskSchema.safeParse(input);
  if (!parsed.success) return { error: "Bad request." };

  const { syncTaskId, date, completed } = parsed.data;

  if (!isWithinBackfillWindow(date, user.timezone)) {
    return { error: "You can only log the last 7 days." };
  }

  const task = await db.syncTask.findUnique({
    where: { id: syncTaskId },
    select: { syncId: true, isActive: true, archivedAt: true },
  });
  if (!task || !task.isActive || task.archivedAt) return { error: "Task not found." };

  const access = await requireMembership(task.syncId, user.id);
  if (!access) return { error: "You're not in this SYNC." };

  if (!(await seasonAllowsWrites(task.syncId, user.timezone))) {
    return { error: "This season is closed. Its record stays as it is." };
  }

  await db.syncTaskLog.upsert({
    where: {
      syncTaskId_userId_date: { syncTaskId, userId: user.id, date: dayKeyToDate(date) },
    },
    update: { completed, completedAt: completed ? new Date() : null },
    create: {
      syncTaskId,
      userId: user.id,
      date: dayKeyToDate(date),
      completed,
      completedAt: completed ? new Date() : null,
    },
  });

  await refreshGoalProgress(task.syncId, user.id);
  const milestones = await evaluateMilestones(task.syncId);

  revalidatePath(`/sync/${task.syncId}`);
  return {
    ok: true,
    milestone: milestones.length ? milestones[milestones.length - 1].threshold : undefined,
  };
}

/**
 * One nudge per person per day, enforced by a unique index rather than a check
 * that could race. The recipient can switch nudges off entirely.
 */
export async function nudgeMemberAction(syncId: string, targetId: string): Promise<SocialState> {
  const user = await requireUser();

  const access = await requireMembership(syncId, user.id);
  if (!access) return { error: "SYNC not found." };
  if (targetId === user.id) return { error: "You can't nudge yourself." };

  const targetMembership = await db.syncMembership.findUnique({
    where: { syncId_userId: { syncId, userId: targetId } },
    select: { status: true },
  });
  if (!targetMembership || targetMembership.status !== "ACCEPTED") {
    return { error: "They're not in this SYNC." };
  }

  const target = await db.user.findUnique({
    where: { id: targetId },
    select: { email: true, displayName: true, allowNudges: true, timezone: true },
  });
  if (!target) return { error: "Member not found." };
  if (!target.allowNudges) return { error: `${target.displayName} has nudges switched off.` };

  const sync = await db.sync.findUnique({ where: { id: syncId }, select: { name: true } });
  const today = todayKey(target.timezone);

  try {
    await db.nudge.create({
      data: { syncId, fromUserId: user.id, toUserId: targetId, date: dayKeyToDate(today) },
    });
  } catch {
    return { error: `You already nudged ${target.displayName} today.` };
  }

  if (target.email && emailConfigured()) {
    await sendEmail({
      to: target.email,
      subject: `${user.displayName} nudged you`,
      text: [
        `${target.displayName},`,
        "",
        `${user.displayName} nudged you in ${sync?.name ?? "your SYNC"}. Shared tasks are still open today.`,
        "",
        appUrl(`/sync/${syncId}`),
        "",
        "Turn nudges off any time in Settings.",
      ].join("\n"),
    });
  }

  revalidatePath(`/sync/${syncId}`);
  return { ok: true, message: `Nudged ${target.displayName}.` };
}


/** An ended season is a closed record. Nothing may be written into it. */
async function seasonAllowsWrites(syncId: string, timezone: string) {
  const sync = await db.sync.findUnique({
    where: { id: syncId },
    select: { startDate: true, endDate: true },
  });
  if (!sync) return false;

  const season = describeSeason(
    sync.startDate ? dateToDayKey(sync.startDate) : null,
    sync.endDate ? dateToDayKey(sync.endDate) : null,
    todayKey(timezone),
  );

  return seasonIsWritable(season.status);
}
