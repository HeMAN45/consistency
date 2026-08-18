"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { importPlaylist, refreshPlaylist } from "@/lib/playlists";
import { requireUser } from "@/lib/session";
import { todayKey } from "@/lib/time";
import { clearFutureWatchTasks, generateWatchTasks } from "@/lib/watch-schedule";
import { YoutubeError, youtubeConfigured } from "@/lib/youtube";

export type WatchState = { error?: string; ok?: boolean; id?: string };

export async function importPlaylistAction(url: unknown): Promise<WatchState> {
  const user = await requireUser();

  if (!youtubeConfigured()) {
    return { error: "YouTube isn't configured on this server yet." };
  }

  const parsed = z.string().trim().min(1).max(500).safeParse(url);
  if (!parsed.success) return { error: "Paste a YouTube link." };

  const count = await db.youtubePlaylist.count({ where: { ownerUserId: user.id } });
  if (count >= 25) return { error: "25 saved playlists is the limit. Remove one first." };

  try {
    const result = await importPlaylist({
      url: parsed.data,
      ownerUserId: user.id,
      todayKey: todayKey(user.timezone),
    });

    if ("error" in result && result.error) return { error: result.error, id: result.id };

    revalidatePath("/watch");
    return { ok: true, id: result.id };
  } catch (error) {
    if (error instanceof YoutubeError) return { error: error.message };
    console.error("playlist import failed", error);
    return { error: "Could not read that playlist." };
  }
}

const planSchema = z.object({
  playlistId: z.string().min(1),
  videosPerDay: z.number().int().min(1).max(20),
  isCore: z.boolean(),
});

export async function updatePlanAction(input: unknown): Promise<WatchState> {
  const user = await requireUser();
  const parsed = planSchema.safeParse(input);
  if (!parsed.success) return { error: "Check the pace." };

  const playlist = await db.youtubePlaylist.findUnique({
    where: { id: parsed.data.playlistId },
    select: { ownerUserId: true },
  });
  if (!playlist || playlist.ownerUserId !== user.id) return { error: "Playlist not found." };

  await db.youtubePlaylist.update({
    where: { id: parsed.data.playlistId },
    data: { videosPerDay: parsed.data.videosPerDay, isCore: parsed.data.isCore },
  });

  // The plan changed, so the visible schedule has to be rebuilt from it.
  await generateWatchTasks({
    userId: user.id,
    playlistId: parsed.data.playlistId,
    todayKey: todayKey(user.timezone),
  });

  revalidatePath("/watch");
  revalidatePath(`/watch/${parsed.data.playlistId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function scheduleAction(playlistId: string): Promise<WatchState> {
  const user = await requireUser();

  const result = await generateWatchTasks({
    userId: user.id,
    playlistId,
    todayKey: todayKey(user.timezone),
  });

  if ("error" in result && result.error) return { error: result.error };

  revalidatePath("/watch");
  revalidatePath(`/watch/${playlistId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function unscheduleAction(playlistId: string): Promise<WatchState> {
  const user = await requireUser();

  const playlist = await db.youtubePlaylist.findUnique({
    where: { id: playlistId },
    select: { ownerUserId: true },
  });
  if (!playlist || playlist.ownerUserId !== user.id) return { error: "Playlist not found." };

  await clearFutureWatchTasks({
    userId: user.id,
    playlistId,
    todayKey: todayKey(user.timezone),
  });

  revalidatePath("/watch");
  revalidatePath(`/watch/${playlistId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function refreshPlaylistAction(playlistId: string): Promise<WatchState> {
  const user = await requireUser();

  const playlist = await db.youtubePlaylist.findUnique({
    where: { id: playlistId },
    select: { ownerUserId: true },
  });
  if (!playlist || playlist.ownerUserId !== user.id) return { error: "Playlist not found." };

  try {
    await refreshPlaylist(playlistId);
    revalidatePath(`/watch/${playlistId}`);
    return { ok: true };
  } catch (error) {
    if (error instanceof YoutubeError) return { error: error.message };
    return { error: "Could not refresh that playlist." };
  }
}

export async function removePlaylistAction(playlistId: string): Promise<WatchState> {
  const user = await requireUser();

  const playlist = await db.youtubePlaylist.findUnique({
    where: { id: playlistId },
    select: { ownerUserId: true },
  });
  if (!playlist || playlist.ownerUserId !== user.id) return { error: "Playlist not found." };

  // Unschedule first, so no orphan tasks are left pointing at deleted videos.
  await clearFutureWatchTasks({
    userId: user.id,
    playlistId,
    todayKey: todayKey(user.timezone),
  });

  await db.youtubePlaylist.delete({ where: { id: playlistId } });

  revalidatePath("/watch");
  revalidatePath("/dashboard");
  return { ok: true };
}
