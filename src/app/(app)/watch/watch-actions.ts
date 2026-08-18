"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { recomputeDay } from "@/lib/progression";
import { requireUser } from "@/lib/session";
import { dayKeyToDate, todayKey } from "@/lib/time";
import { COMPLETION_RATIO, taskForVideo } from "@/lib/watch-progress";

export type PlayerState = { error?: string; ok?: boolean; completed?: boolean };

const progressSchema = z.object({
  videoId: z.string().min(1),
  watchedSeconds: z.number().int().min(0).max(60 * 60 * 12),
});

/**
 * Accumulated seconds only ever move up, and only by what the player reports
 * as actually played. Dragging the scrubber to the end changes position, not
 * accumulated time, so it cannot complete anything.
 */
export async function saveWatchProgressAction(input: unknown): Promise<PlayerState> {
  const user = await requireUser();
  const parsed = progressSchema.safeParse(input);
  if (!parsed.success) return { error: "Bad request." };

  const video = await db.youtubeVideo.findUnique({
    where: { id: parsed.data.videoId },
    select: {
      durationSeconds: true,
      playlist: { select: { ownerUserId: true } },
    },
  });

  if (!video || video.playlist.ownerUserId !== user.id) return { error: "Video not found." };

  const existing = await db.watchProgress.findUnique({
    where: { userId_videoId: { userId: user.id, videoId: parsed.data.videoId } },
    select: { watchedSeconds: true, completedAt: true },
  });

  const seconds = Math.max(existing?.watchedSeconds ?? 0, parsed.data.watchedSeconds);
  const threshold = Math.floor(video.durationSeconds * COMPLETION_RATIO);
  const reached = video.durationSeconds > 0 && seconds >= threshold;

  await db.watchProgress.upsert({
    where: { userId_videoId: { userId: user.id, videoId: parsed.data.videoId } },
    update: { watchedSeconds: seconds },
    create: { userId: user.id, videoId: parsed.data.videoId, watchedSeconds: seconds },
  });

  if (!reached || existing?.completedAt) return { ok: true, completed: Boolean(existing?.completedAt) };

  const today = todayKey(user.timezone);
  const task = await taskForVideo(user.id, parsed.data.videoId, today);
  if (!task) return { ok: true };

  await db.$transaction([
    db.watchProgress.update({
      where: { userId_videoId: { userId: user.id, videoId: parsed.data.videoId } },
      data: { completedAt: new Date() },
    }),
    db.taskLog.upsert({
      where: {
        taskId_userId_date: {
          taskId: task.id,
          userId: user.id,
          date: dayKeyToDate(task.date),
        },
      },
      update: { completed: true, completedAt: new Date() },
      create: {
        taskId: task.id,
        userId: user.id,
        date: dayKeyToDate(task.date),
        completed: true,
        completedAt: new Date(),
      },
    }),
  ]);

  await recomputeDay(user.id, task.date);

  revalidatePath("/dashboard");
  revalidatePath("/watch");
  return { ok: true, completed: true };
}

/** Manual completion, for when you watched it somewhere else. */
export async function markVideoWatchedAction(videoId: string): Promise<PlayerState> {
  const user = await requireUser();

  const video = await db.youtubeVideo.findUnique({
    where: { id: videoId },
    select: { playlist: { select: { ownerUserId: true } } },
  });
  if (!video || video.playlist.ownerUserId !== user.id) return { error: "Video not found." };

  const today = todayKey(user.timezone);
  const task = await taskForVideo(user.id, videoId, today);
  if (!task) return { error: "Could not schedule that video." };

  await db.$transaction([
    db.watchProgress.upsert({
      where: { userId_videoId: { userId: user.id, videoId } },
      update: { completedAt: new Date() },
      create: { userId: user.id, videoId, watchedSeconds: 0, completedAt: new Date() },
    }),
    db.taskLog.upsert({
      where: {
        taskId_userId_date: { taskId: task.id, userId: user.id, date: dayKeyToDate(task.date) },
      },
      update: { completed: true, completedAt: new Date() },
      create: {
        taskId: task.id,
        userId: user.id,
        date: dayKeyToDate(task.date),
        completed: true,
        completedAt: new Date(),
      },
    }),
  ]);

  await recomputeDay(user.id, task.date);

  revalidatePath("/dashboard");
  revalidatePath("/watch");
  return { ok: true, completed: true };
}


const catchUpSchema = z.object({
  playlistId: z.string().min(1),
  throughPosition: z.number().int().min(0).max(5000),
});

/**
 * "I've already watched the first N."
 *
 * Recorded as watch progress only. No TaskLog is written, because a completed
 * log is a day of history: importing forty old videos must not rewrite forty
 * days of rating, streak and heatmap. Prior progress moves the plan forward
 * without pretending you earned anything for it.
 */
export async function catchUpAction(input: unknown): Promise<PlayerState> {
  const user = await requireUser();
  const parsed = catchUpSchema.safeParse(input);
  if (!parsed.success) return { error: "Bad request." };

  const playlist = await db.youtubePlaylist.findUnique({
    where: { id: parsed.data.playlistId },
    select: {
      ownerUserId: true,
      videos: {
        where: { available: true, position: { lte: parsed.data.throughPosition } },
        select: { id: true },
      },
    },
  });

  if (!playlist || playlist.ownerUserId !== user.id) return { error: "Playlist not found." };

  const now = new Date();
  await db.$transaction(
    playlist.videos.map((video) =>
      db.watchProgress.upsert({
        where: { userId_videoId: { userId: user.id, videoId: video.id } },
        update: { completedAt: now },
        create: { userId: user.id, videoId: video.id, watchedSeconds: 0, completedAt: now },
      }),
    ),
  );

  revalidatePath(`/watch/${parsed.data.playlistId}`);
  revalidatePath("/watch");
  return { ok: true };
}

/** Individual toggle, for correcting the catch-up point one video at a time. */
export async function toggleWatchedAction(
  videoId: string,
  watched: boolean,
): Promise<PlayerState> {
  const user = await requireUser();

  const video = await db.youtubeVideo.findUnique({
    where: { id: videoId },
    select: { playlistId: true, playlist: { select: { ownerUserId: true } } },
  });
  if (!video || video.playlist.ownerUserId !== user.id) return { error: "Video not found." };

  // A video completed through a real task owns a day of history, so it can only
  // be undone by unticking that task, not from here.
  const logged = await db.task.findFirst({
    where: {
      ownerUserId: user.id,
      youtubeVideoId: videoId,
      logs: { some: { userId: user.id, completed: true } },
    },
    select: { id: true },
  });

  if (logged && !watched) {
    return { error: "That one was logged as a task. Untick it on the day it was completed." };
  }

  await db.watchProgress.upsert({
    where: { userId_videoId: { userId: user.id, videoId } },
    update: { completedAt: watched ? new Date() : null },
    create: {
      userId: user.id,
      videoId,
      watchedSeconds: 0,
      completedAt: watched ? new Date() : null,
    },
  });

  revalidatePath(`/watch/${video.playlistId}`);
  revalidatePath("/watch");
  return { ok: true };
}
