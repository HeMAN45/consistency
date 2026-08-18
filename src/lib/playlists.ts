import { db } from "@/lib/db";
import { dayKeyToDate, dateToDayKey, type DayKey } from "@/lib/time";
import { fetchPlaylist, fetchSingleVideo, parsePlaylistId, parseVideoId } from "@/lib/youtube";

/**
 * Playlists are cached metadata. YouTube is called on import and on an explicit
 * refresh, never on page load: playlists change rarely and quota is worth
 * respecting.
 */

export type StoredVideo = {
  id: string;
  youtubeId: string;
  title: string;
  position: number;
  durationSeconds: number;
  available: boolean;
  watched: boolean;
  scheduledFor: DayKey | null;
};

export async function importPlaylist(input: {
  url: string;
  ownerUserId?: string;
  syncId?: string;
  todayKey: DayKey;
}) {
  const playlistId = parsePlaylistId(input.url);
  const videoId = playlistId ? null : parseVideoId(input.url);

  if (!playlistId && !videoId) return { error: "That isn't a YouTube playlist or video link." };

  const fetched = playlistId
    ? await fetchPlaylist(playlistId)
    : await fetchSingleVideo(videoId as string);

  const existing = await db.youtubePlaylist.findFirst({
    where: input.ownerUserId
      ? { ownerUserId: input.ownerUserId, youtubeId: fetched.youtubeId }
      : { syncId: input.syncId, youtubeId: fetched.youtubeId },
    select: { id: true },
  });

  if (existing) return { error: "That's already saved.", id: existing.id };

  const playlist = await db.youtubePlaylist.create({
    data: {
      youtubeId: fetched.youtubeId,
      kind: playlistId ? "PLAYLIST" : "SINGLE",
      title: fetched.title,
      channelTitle: fetched.channelTitle,
      thumbnailUrl: fetched.thumbnailUrl,
      ownerUserId: input.ownerUserId ?? null,
      syncId: input.syncId ?? null,
      startDate: dayKeyToDate(input.todayKey),
      videosPerDay: fetched.videos.length === 1 ? 1 : 2,
      videos: {
        create: fetched.videos.map((video) => ({
          youtubeId: video.youtubeId,
          title: video.title.slice(0, 200),
          position: video.position,
          durationSeconds: video.durationSeconds,
          thumbnailUrl: video.thumbnailUrl,
          available: video.available,
        })),
      },
    },
    select: { id: true },
  });

  return { id: playlist.id };
}

/**
 * Re-reads the playlist from YouTube. New videos are added, existing ones keep
 * their id so scheduled tasks survive, and anything that has disappeared is
 * marked unavailable rather than deleted, so totals stay honest.
 */
export async function refreshPlaylist(playlistId: string) {
  const playlist = await db.youtubePlaylist.findUnique({
    where: { id: playlistId },
    select: { id: true, youtubeId: true, kind: true },
  });
  if (!playlist) return { error: "Playlist not found." };

  const fetched =
    playlist.kind === "SINGLE"
      ? await fetchSingleVideo(playlist.youtubeId)
      : await fetchPlaylist(playlist.youtubeId);

  const seen = new Set(fetched.videos.map((video) => video.youtubeId));

  await db.$transaction([
    ...fetched.videos.map((video) =>
      db.youtubeVideo.upsert({
        where: { playlistId_youtubeId: { playlistId, youtubeId: video.youtubeId } },
        update: {
          title: video.title.slice(0, 200),
          position: video.position,
          durationSeconds: video.durationSeconds,
          available: video.available,
        },
        create: {
          playlistId,
          youtubeId: video.youtubeId,
          title: video.title.slice(0, 200),
          position: video.position,
          durationSeconds: video.durationSeconds,
          thumbnailUrl: video.thumbnailUrl,
          available: video.available,
        },
      }),
    ),
    db.youtubeVideo.updateMany({
      where: { playlistId, youtubeId: { notIn: [...seen] } },
      data: { available: false },
    }),
    db.youtubePlaylist.update({
      where: { id: playlistId },
      data: { title: fetched.title, fetchedAt: new Date() },
    }),
  ]);

  return { ok: true };
}

export async function listPlaylists(userId: string) {
  const playlists = await db.youtubePlaylist.findMany({
    where: { ownerUserId: userId },
    orderBy: { createdAt: "desc" },
    include: {
      videos: {
        select: { id: true, durationSeconds: true, available: true },
      },
    },
  });

  const videoIds = playlists.flatMap((playlist) => playlist.videos.map((video) => video.id));

  const [completed, priorProgress] = await Promise.all([
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

  // Watched means either a completed task, or progress carried in from before
  // you joined. Both count as done; only the first ever touched a rating.
  const watched = new Set([
    ...completed.map((task) => task.youtubeVideoId),
    ...priorProgress.map((row) => row.videoId),
  ]);

  return playlists.map((playlist) => {
    const usable = playlist.videos.filter((video) => video.available);
    const done = usable.filter((video) => watched.has(video.id)).length;

    return {
      id: playlist.id,
      title: playlist.title,
      channelTitle: playlist.channelTitle,
      kind: playlist.kind,
      isCore: playlist.isCore,
      videosPerDay: playlist.videosPerDay,
      startDate: playlist.startDate ? dateToDayKey(playlist.startDate) : null,
      fetchedAt: playlist.fetchedAt,
      total: usable.length,
      watched: done,
      remaining: usable.length - done,
      totalSeconds: usable.reduce((sum, video) => sum + video.durationSeconds, 0),
      remainingSeconds: usable
        .filter((video) => !watched.has(video.id))
        .reduce((sum, video) => sum + video.durationSeconds, 0),
    };
  });
}

export async function loadPlaylist(playlistId: string, userId: string) {
  const playlist = await db.youtubePlaylist.findUnique({
    where: { id: playlistId },
    include: { videos: { orderBy: { position: "asc" } } },
  });

  if (!playlist || playlist.ownerUserId !== userId) return null;

  const [tasks, progress] = await Promise.all([
    db.task.findMany({
      where: {
        ownerUserId: userId,
        youtubeVideoId: { in: playlist.videos.map((video) => video.id) },
      },
      select: {
        youtubeVideoId: true,
        scheduledDate: true,
        logs: { where: { userId }, select: { completed: true } },
      },
    }),
    db.watchProgress.findMany({
      where: { userId, videoId: { in: playlist.videos.map((video) => video.id) } },
      select: { videoId: true, completedAt: true, watchedSeconds: true },
    }),
  ]);

  const byVideo = new Map(tasks.map((task) => [task.youtubeVideoId, task]));
  const progressByVideo = new Map(progress.map((row) => [row.videoId, row]));

  const videos: StoredVideo[] = playlist.videos.map((video) => {
    const task = byVideo.get(video.id);
    const watched =
      Boolean(task?.logs.some((log) => log.completed)) ||
      Boolean(progressByVideo.get(video.id)?.completedAt);

    return {
      id: video.id,
      youtubeId: video.youtubeId,
      title: video.title,
      position: video.position,
      durationSeconds: video.durationSeconds,
      available: video.available,
      watched,
      scheduledFor: task?.scheduledDate ? dateToDayKey(task.scheduledDate) : null,
    };
  });

  return {
    id: playlist.id,
    youtubeId: playlist.youtubeId,
    kind: playlist.kind,
    title: playlist.title,
    channelTitle: playlist.channelTitle,
    isCore: playlist.isCore,
    videosPerDay: playlist.videosPerDay,
    startDate: playlist.startDate ? dateToDayKey(playlist.startDate) : null,
    fetchedAt: playlist.fetchedAt,
    videos,
  };
}
