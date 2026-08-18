"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { importPlaylist } from "@/lib/playlists";
import { requireUser } from "@/lib/session";
import { requireMembership } from "@/lib/sync";
import { generateMemberCourseTasks, generateSharedCourseTasks } from "@/lib/sync-playlists";
import { todayKey } from "@/lib/time";
import { YoutubeError, youtubeConfigured } from "@/lib/youtube";

export type CourseState = { error?: string; ok?: boolean; id?: string };

const addSchema = z.object({
  syncId: z.string().min(1),
  url: z.string().trim().min(1).max(500),
  sharedSchedule: z.boolean(),
});

/** Any accepted member can add a course, same as any other shared work. */
export async function addSyncCourseAction(input: unknown): Promise<CourseState> {
  const user = await requireUser();
  const parsed = addSchema.safeParse(input);
  if (!parsed.success) return { error: "Paste a YouTube link." };

  if (!youtubeConfigured()) return { error: "YouTube isn't configured on this server yet." };

  const access = await requireMembership(parsed.data.syncId, user.id);
  if (!access) return { error: "SYNC not found." };

  const count = await db.youtubePlaylist.count({ where: { syncId: parsed.data.syncId } });
  if (count >= 10) return { error: "10 courses is the limit for one SYNC." };

  try {
    const result = await importPlaylist({
      url: parsed.data.url,
      syncId: parsed.data.syncId,
      todayKey: todayKey(user.timezone),
    });

    if ("error" in result && result.error) return { error: result.error, id: result.id };

    await db.youtubePlaylist.update({
      where: { id: result.id },
      data: { sharedSchedule: parsed.data.sharedSchedule },
    });

    revalidatePath(`/sync/${parsed.data.syncId}`);
    return { ok: true, id: result.id };
  } catch (error) {
    if (error instanceof YoutubeError) return { error: error.message };
    console.error("sync course import failed", error);
    return { error: "Could not read that playlist." };
  }
}

const planSchema = z.object({
  playlistId: z.string().min(1),
  videosPerDay: z.number().int().min(1).max(20),
  isCore: z.boolean(),
});

export async function updateSyncCourseAction(input: unknown): Promise<CourseState> {
  const user = await requireUser();
  const parsed = planSchema.safeParse(input);
  if (!parsed.success) return { error: "Check the pace." };

  const playlist = await db.youtubePlaylist.findUnique({
    where: { id: parsed.data.playlistId },
    select: { syncId: true, sharedSchedule: true },
  });
  if (!playlist?.syncId) return { error: "Course not found." };

  const access = await requireMembership(playlist.syncId, user.id);
  if (!access) return { error: "You're not in this SYNC." };

  // A shared timetable belongs to the room, so only its creator sets the pace.
  // An individual course is each member's own business.
  if (playlist.sharedSchedule && !access.isOwner) {
    return { error: "This course runs on the SYNC's schedule. Only the creator sets the pace." };
  }

  await db.youtubePlaylist.update({
    where: { id: parsed.data.playlistId },
    data: { videosPerDay: parsed.data.videosPerDay, isCore: parsed.data.isCore },
  });

  const today = todayKey(user.timezone);
  const result = playlist.sharedSchedule
    ? await generateSharedCourseTasks({ playlistId: parsed.data.playlistId, userId: user.id, todayKey: today })
    : await generateMemberCourseTasks({ playlistId: parsed.data.playlistId, userId: user.id, todayKey: today });

  if ("error" in result && result.error) return { error: result.error };

  revalidatePath(`/sync/${playlist.syncId}`);
  revalidatePath(`/sync/${playlist.syncId}/course/${parsed.data.playlistId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function scheduleSyncCourseAction(playlistId: string): Promise<CourseState> {
  const user = await requireUser();

  const playlist = await db.youtubePlaylist.findUnique({
    where: { id: playlistId },
    select: { syncId: true, sharedSchedule: true },
  });
  if (!playlist?.syncId) return { error: "Course not found." };

  const today = todayKey(user.timezone);
  const result = playlist.sharedSchedule
    ? await generateSharedCourseTasks({ playlistId, userId: user.id, todayKey: today })
    : await generateMemberCourseTasks({ playlistId, userId: user.id, todayKey: today });

  if ("error" in result && result.error) return { error: result.error };

  revalidatePath(`/sync/${playlist.syncId}`);
  revalidatePath(`/sync/${playlist.syncId}/course/${playlistId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function removeSyncCourseAction(playlistId: string): Promise<CourseState> {
  const user = await requireUser();

  const playlist = await db.youtubePlaylist.findUnique({
    where: { id: playlistId },
    select: { syncId: true },
  });
  if (!playlist?.syncId) return { error: "Course not found." };

  const access = await requireMembership(playlist.syncId, user.id);
  if (!access) return { error: "You're not in this SYNC." };
  if (!access.isOwner) return { error: "Only the SYNC creator can remove a course." };

  await db.youtubePlaylist.delete({ where: { id: playlistId } });

  revalidatePath(`/sync/${playlist.syncId}`);
  return { ok: true };
}
