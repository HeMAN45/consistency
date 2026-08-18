import { db } from "@/lib/db";
import { requireMembership } from "@/lib/sync";
import { dateToDayKey, dayKeyToDate, shiftDayKey, type DayKey } from "@/lib/time";

/**
 * A course inside a SYNC can run two ways.
 *
 * Shared schedule: one timetable for the room. Video three lands on day two for
 * everybody, and it does not cascade, because a group commitment that quietly
 * reschedules itself around whoever is slowest is not a commitment.
 *
 * Individual pace: the playlist is shared, the plan is not. Each member gets
 * their own personal tasks at their own pace, and those cascade exactly like a
 * personal course. Shared direction, individual accountability.
 */

const DAYS_AHEAD = 13;

export async function listSyncPlaylists(syncId: string, userId: string) {
  const playlists = await db.youtubePlaylist.findMany({
    where: { syncId },
    orderBy: { createdAt: "desc" },
    include: { videos: { select: { id: true, durationSeconds: true, available: true } } },
  });

  if (playlists.length === 0) return [];

  const videoIds = playlists.flatMap((playlist) => playlist.videos.map((video) => video.id));

  const [sharedDone, personalDone, prior] = await Promise.all([
    db.syncTaskLog.findMany({
      where: { userId, completed: true, syncTask: { youtubeVideoId: { in: videoIds } } },
      select: { syncTask: { select: { youtubeVideoId: true } } },
    }),
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

  const watched = new Set<string | null>([
    ...sharedDone.map((log) => log.syncTask.youtubeVideoId),
    ...personalDone.map((task) => task.youtubeVideoId),
    ...prior.map((row) => row.videoId),
  ]);

  return playlists.map((playlist) => {
    const usable = playlist.videos.filter((video) => video.available);
    const done = usable.filter((video) => watched.has(video.id));

    return {
      id: playlist.id,
      title: playlist.title,
      sharedSchedule: playlist.sharedSchedule,
      videosPerDay: playlist.videosPerDay,
      isCore: playlist.isCore,
      total: usable.length,
      watched: done.length,
      remaining: usable.length - done.length,
      remainingSeconds: usable
        .filter((video) => !watched.has(video.id))
        .reduce((sum, video) => sum + video.durationSeconds, 0),
    };
  });
}

export async function loadSyncPlaylist(playlistId: string, userId: string) {
  const playlist = await db.youtubePlaylist.findUnique({
    where: { id: playlistId },
    include: { videos: { orderBy: { position: "asc" } } },
  });

  if (!playlist?.syncId) return null;

  const access = await requireMembership(playlist.syncId, userId);
  if (!access) return null;

  const videoIds = playlist.videos.map((video) => video.id);

  const [sharedTasks, personalTasks, prior] = await Promise.all([
    db.syncTask.findMany({
      where: { syncId: playlist.syncId, youtubeVideoId: { in: videoIds } },
      select: {
        youtubeVideoId: true,
        scheduledDate: true,
        logs: { where: { userId }, select: { completed: true } },
      },
    }),
    db.task.findMany({
      where: { ownerUserId: userId, youtubeVideoId: { in: videoIds } },
      select: {
        youtubeVideoId: true,
        scheduledDate: true,
        logs: { where: { userId }, select: { completed: true } },
      },
    }),
    db.watchProgress.findMany({
      where: { userId, videoId: { in: videoIds }, completedAt: { not: null } },
      select: { videoId: true },
    }),
  ]);

  const relevant = playlist.sharedSchedule ? sharedTasks : personalTasks;
  const byVideo = new Map(relevant.map((task) => [task.youtubeVideoId, task]));
  const priorIds = new Set(prior.map((row) => row.videoId));

  return {
    id: playlist.id,
    syncId: playlist.syncId,
    title: playlist.title,
    channelTitle: playlist.channelTitle,
    sharedSchedule: playlist.sharedSchedule,
    videosPerDay: playlist.videosPerDay,
    isCore: playlist.isCore,
    isOwner: access.isOwner,
    videos: playlist.videos.map((video) => {
      const task = byVideo.get(video.id);
      return {
        id: video.id,
        youtubeId: video.youtubeId,
        title: video.title,
        position: video.position,
        durationSeconds: video.durationSeconds,
        available: video.available,
        watched:
          Boolean(task?.logs.some((log) => log.completed)) || priorIds.has(video.id),
        scheduledFor: task?.scheduledDate ? dateToDayKey(task.scheduledDate) : null,
      };
    }),
  };
}

/**
 * Shared mode. One timetable, laid out in playlist order from today, ignoring
 * who has and hasn't kept up: the date is the group's promise, not a per-member
 * queue.
 */
export async function generateSharedCourseTasks(input: {
  playlistId: string;
  userId: string;
  todayKey: DayKey;
}) {
  const playlist = await db.youtubePlaylist.findUnique({
    where: { id: input.playlistId },
    include: { videos: { orderBy: { position: "asc" } } },
  });

  if (!playlist?.syncId) return { error: "Course not found." };

  const access = await requireMembership(playlist.syncId, input.userId);
  if (!access) return { error: "You're not in this SYNC." };

  const videoIds = playlist.videos.map((video) => video.id);

  const existing = await db.syncTask.findMany({
    where: { syncId: playlist.syncId, youtubeVideoId: { in: videoIds } },
    select: { id: true, youtubeVideoId: true, scheduledDate: true, logs: { select: { id: true } } },
  });

  // Untouched future entries are disposable, so a pace change rewrites the plan
  // rather than layering a second one on top of it.
  const disposable = existing.filter(
    (task) =>
      task.logs.length === 0 &&
      task.scheduledDate &&
      dateToDayKey(task.scheduledDate) > input.todayKey,
  );

  if (disposable.length > 0) {
    await db.syncTask.deleteMany({ where: { id: { in: disposable.map((task) => task.id) } } });
  }

  const kept = new Set(
    existing
      .filter((task) => !disposable.some((entry) => entry.id === task.id))
      .map((task) => task.youtubeVideoId),
  );

  const queue = playlist.videos.filter((video) => video.available && !kept.has(video.id));

  const created: { videoId: string; title: string; date: DayKey }[] = [];
  let cursor = 0;

  for (let offset = 0; offset <= DAYS_AHEAD && cursor < queue.length; offset++) {
    const date = shiftDayKey(input.todayKey, offset);

    for (let slot = 0; slot < playlist.videosPerDay && cursor < queue.length; slot++) {
      created.push({ videoId: queue[cursor].id, title: queue[cursor].title, date });
      cursor += 1;
    }
  }

  if (created.length > 0) {
    const last = await db.syncTask.findFirst({
      where: { syncId: playlist.syncId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    await db.syncTask.createMany({
      data: created.map((entry, index) => ({
        name: entry.title.slice(0, 60),
        category: "CUSTOM" as const,
        dayType: "ONE_OFF" as const,
        scheduledDate: dayKeyToDate(entry.date),
        youtubeVideoId: entry.videoId,
        syncId: playlist.syncId as string,
        createdByUserId: input.userId,
        isCore: playlist.isCore,
        sortOrder: (last?.sortOrder ?? 0) + index + 1,
      })),
    });
  }

  return { ok: true, scheduled: created.length };
}

/** Individual mode: the member's own tasks, cascading like a personal course. */
export async function generateMemberCourseTasks(input: {
  playlistId: string;
  userId: string;
  todayKey: DayKey;
}) {
  const playlist = await db.youtubePlaylist.findUnique({
    where: { id: input.playlistId },
    include: { videos: { orderBy: { position: "asc" } } },
  });

  if (!playlist?.syncId) return { error: "Course not found." };

  const access = await requireMembership(playlist.syncId, input.userId);
  if (!access) return { error: "You're not in this SYNC." };

  const videoIds = playlist.videos.map((video) => video.id);

  const [tasks, prior] = await Promise.all([
    db.task.findMany({
      where: { ownerUserId: input.userId, youtubeVideoId: { in: videoIds } },
      select: {
        id: true,
        youtubeVideoId: true,
        scheduledDate: true,
        logs: { where: { userId: input.userId }, select: { completed: true } },
      },
    }),
    db.watchProgress.findMany({
      where: { userId: input.userId, videoId: { in: videoIds }, completedAt: { not: null } },
      select: { videoId: true },
    }),
  ]);

  const watched = new Set<string | null>([
    ...tasks.filter((task) => task.logs.some((log) => log.completed)).map((t) => t.youtubeVideoId),
    ...prior.map((row) => row.videoId),
  ]);

  const disposable = tasks.filter(
    (task) =>
      task.logs.length === 0 &&
      task.scheduledDate &&
      dateToDayKey(task.scheduledDate) > input.todayKey,
  );

  if (disposable.length > 0) {
    await db.task.deleteMany({ where: { id: { in: disposable.map((task) => task.id) } } });
  }

  const scheduledToday = new Set(
    tasks
      .filter(
        (task) => task.scheduledDate && dateToDayKey(task.scheduledDate) === input.todayKey,
      )
      .map((task) => task.youtubeVideoId),
  );

  const queue = playlist.videos.filter(
    (video) => video.available && !watched.has(video.id) && !scheduledToday.has(video.id),
  );

  const created: { videoId: string; title: string; date: DayKey }[] = [];
  let cursor = 0;

  for (let offset = 0; offset <= DAYS_AHEAD && cursor < queue.length; offset++) {
    const date = shiftDayKey(input.todayKey, offset);
    const taken = offset === 0 ? scheduledToday.size : 0;

    for (let slot = taken; slot < playlist.videosPerDay && cursor < queue.length; slot++) {
      created.push({ videoId: queue[cursor].id, title: queue[cursor].title, date });
      cursor += 1;
    }
  }

  if (created.length > 0) {
    const last = await db.task.findFirst({
      where: { ownerUserId: input.userId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    await db.task.createMany({
      data: created.map((entry, index) => ({
        name: entry.title.slice(0, 60),
        category: "CUSTOM" as const,
        customLabel: playlist.title.slice(0, 24),
        dayType: "ONE_OFF" as const,
        scheduledDate: dayKeyToDate(entry.date),
        youtubeVideoId: entry.videoId,
        ownerUserId: input.userId,
        createdByUserId: input.userId,
        isCore: playlist.isCore,
        sortOrder: (last?.sortOrder ?? 0) + index + 1,
      })),
    });
  }

  return { ok: true, scheduled: created.length };
}
