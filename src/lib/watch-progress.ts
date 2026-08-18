import { db } from "@/lib/db";
import { dayKeyToDate, dateToDayKey, shiftDayKey, todayKey, type DayKey } from "@/lib/time";
import { behindBy, finishDayKey } from "@/lib/playlist-maths";
import { BACKFILL_DAYS } from "@/lib/backfill";

/** Roughly nine tenths of the runtime, actually played. */
export const COMPLETION_RATIO = 0.9;

/**
 * Finds the task a completed video should tick, or creates one.
 *
 * Order matters: today's scheduled task first, then an unwatched one from
 * inside the backfill window, and only then a fresh task for today. Watching
 * ahead of schedule should still count, but it must never rewrite a day that
 * has already closed.
 */
export async function taskForVideo(userId: string, videoId: string, today: DayKey) {
  const tasks = await db.task.findMany({
    where: { ownerUserId: userId, youtubeVideoId: videoId, archivedAt: null },
    select: {
      id: true,
      scheduledDate: true,
      logs: { where: { userId }, select: { completed: true } },
    },
    orderBy: { scheduledDate: "asc" },
  });

  const onToday = tasks.find(
    (task) => task.scheduledDate && dateToDayKey(task.scheduledDate) === today,
  );
  if (onToday) return { id: onToday.id, date: today };

  const earliest = shiftDayKey(today, -BACKFILL_DAYS);
  const inWindow = tasks.find((task) => {
    if (!task.scheduledDate) return false;
    const key = dateToDayKey(task.scheduledDate);
    return key >= earliest && key <= today && !task.logs.some((log) => log.completed);
  });
  if (inWindow) {
    return { id: inWindow.id, date: dateToDayKey(inWindow.scheduledDate as Date) };
  }

  const video = await db.youtubeVideo.findUnique({
    where: { id: videoId },
    select: { title: true, playlist: { select: { title: true, isCore: true } } },
  });
  if (!video) return null;

  const last = await db.task.findFirst({
    where: { ownerUserId: userId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const created = await db.task.create({
    data: {
      name: video.title.slice(0, 60),
      category: "CUSTOM",
      customLabel: video.playlist.title.slice(0, 24),
      dayType: "ONE_OFF",
      scheduledDate: dayKeyToDate(today),
      youtubeVideoId: videoId,
      ownerUserId: userId,
      createdByUserId: userId,
      isCore: video.playlist.isCore,
      sortOrder: (last?.sortOrder ?? 0) + 1,
    },
    select: { id: true },
  });

  return { id: created.id, date: today };
}

export type PlaylistProgress = {
  id: string;
  title: string;
  total: number;
  watched: number;
  remaining: number;
  watchedSeconds: number;
  remainingSeconds: number;
  videosPerDay: number;
  behind: number;
  originalFinish: DayKey | null;
  projectedFinish: DayKey | null;
  isCore: boolean;
};

/** Per-playlist progress, plus how far the plan has slipped. */
export async function watchSummary(userId: string, timezone: string): Promise<PlaylistProgress[]> {
  const today = todayKey(timezone);

  const playlists = await db.youtubePlaylist.findMany({
    where: { ownerUserId: userId },
    include: { videos: { select: { id: true, durationSeconds: true, available: true } } },
  });

  if (playlists.length === 0) return [];

  const videoIds = playlists.flatMap((playlist) => playlist.videos.map((video) => video.id));

  const [done, prior] = await Promise.all([
    db.task.findMany({
      where: {
        ownerUserId: userId,
        youtubeVideoId: { in: videoIds },
        logs: { some: { userId, completed: true } },
      },
      select: { youtubeVideoId: true },
    }),
    db.watchProgress.findMany({
      where: { userId, videoId: { in: videoIds }, completedAt: { not: null } },
      select: { videoId: true },
    }),
  ]);

  const watchedIds = new Set<string | null>([
    ...done.map((task) => task.youtubeVideoId),
    ...prior.map((row) => row.videoId),
  ]);

  return playlists.map((playlist) => {
    const usable = playlist.videos.filter((video) => video.available);
    const watched = usable.filter((video) => watchedIds.has(video.id));
    const remaining = usable.filter((video) => !watchedIds.has(video.id));

    const startKey = playlist.startDate ? dateToDayKey(playlist.startDate) : today;

    return {
      id: playlist.id,
      title: playlist.title,
      total: usable.length,
      watched: watched.length,
      remaining: remaining.length,
      watchedSeconds: watched.reduce((sum, video) => sum + video.durationSeconds, 0),
      remainingSeconds: remaining.reduce((sum, video) => sum + video.durationSeconds, 0),
      videosPerDay: playlist.videosPerDay,
      behind: behindBy({
        startDayKey: startKey,
        todayKey: today,
        perDay: playlist.videosPerDay,
        watched: watched.length,
        total: usable.length,
      }),
      // What the plan promised on day one, against where it now lands.
      originalFinish: finishDayKey(startKey, usable.length, playlist.videosPerDay),
      projectedFinish: finishDayKey(today, remaining.length, playlist.videosPerDay),
      isCore: playlist.isCore,
    };
  });
}
