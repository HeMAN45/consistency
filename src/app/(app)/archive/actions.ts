"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { requireMembership } from "@/lib/sync";
import { seasonStatus } from "@/lib/sync-rules";
import { dateToDayKey, todayKey } from "@/lib/time";

export type ArchiveState = { error?: string; ok?: boolean };

/**
 * Archiving hides a finished SYNC from the active list while keeping every row
 * intact. It is reversible, unlike deleting, so it is the default action.
 */
export async function archiveSyncAction(syncId: string): Promise<ArchiveState> {
  const user = await requireUser();

  const access = await requireMembership(syncId, user.id);
  if (!access) return { error: "SYNC not found." };
  if (!access.isOwner) return { error: "Only the creator can archive a SYNC." };

  await db.sync.update({ where: { id: syncId }, data: { archivedAt: new Date() } });

  revalidatePath("/sync");
  revalidatePath("/archive");
  return { ok: true };
}

export async function restoreSyncAction(syncId: string): Promise<ArchiveState> {
  const user = await requireUser();

  const sync = await db.sync.findUnique({
    where: { id: syncId },
    select: { ownerUserId: true },
  });
  if (!sync) return { error: "SYNC not found." };
  if (sync.ownerUserId !== user.id) return { error: "Only the creator can restore a SYNC." };

  await db.sync.update({ where: { id: syncId }, data: { archivedAt: null } });

  revalidatePath("/sync");
  revalidatePath("/archive");
  return { ok: true };
}

/**
 * Permanent, and only from the archive. A running SYNC cannot be deleted out
 * from under its members: end the season or archive it first.
 */
export async function deleteSyncAction(syncId: string): Promise<ArchiveState> {
  const user = await requireUser();

  const sync = await db.sync.findUnique({
    where: { id: syncId },
    select: { ownerUserId: true, startDate: true, endDate: true, archivedAt: true },
  });

  if (!sync) return { error: "SYNC not found." };
  if (sync.ownerUserId !== user.id) return { error: "Only the creator can delete a SYNC." };

  const status = seasonStatus(
    sync.startDate ? dateToDayKey(sync.startDate) : null,
    sync.endDate ? dateToDayKey(sync.endDate) : null,
    todayKey(user.timezone),
  );

  if (!sync.archivedAt && status !== "ended") {
    return { error: "This SYNC is still running. Archive it first." };
  }

  await db.sync.delete({ where: { id: syncId } });

  revalidatePath("/sync");
  revalidatePath("/archive");
  return { ok: true };
}
