import { db } from "@/lib/db";
import { dayKeyToDate, dateToDayKey, shiftDayKey, type DayKey } from "@/lib/time";

/**
 * Generates the dated tasks a playlist plan implies.
 *
 * The plan is never stored as a fixed timetable. Each run schedules the next
 * unwatched videos from today forward, which gives cascade rollover for free:
 * skip a day and the same video simply appears again tomorrow, everything
 * behind it shifts, and the finish date moves.
 *
 * History is never rewritten. Yesterday's task stays exactly as it was,
 * incomplete, with its rating already applied. Rolling forward reschedules the
 * work; it does not undo the miss.
 */

const DAYS_AHEAD = 13; // today plus a fortnight of visible plan

export async function generateWatchTasks(input: {
  userId: string;
  playlistId: string;
  todayKey: DayKey;
}) {
  const playlist = await db.youtubePlaylist.findUnique({
    where: { id: input.playlistId },
    include: { videos: { orderBy: { position: "asc" } } },
  });

  if (!playlist || playlist.ownerUserId !== input.userId) return { error: "Playlist not found." };
  if (playlist.videosPerDay < 1) return { error: "Set a pace of at least one video a day." };

  const videoIds = playlist.videos.map((video) => video.id);

  const tasks = await db.task.findMany({
    where: { ownerUserId: input.userId, youtubeVideoId: { in: videoIds } },
    select: {
      id: true,
      youtubeVideoId: true,
      scheduledDate: true,
      archivedAt: true,
      logs: { where: { userId: input.userId }, select: { id: true, completed: true } },
    },
  });

  const priorProgress = await db.watchProgress.findMany({
    where: { userId: input.userId, videoId: { in: videoIds }, completedAt: { not: null } },
    select: { videoId: true },
  });

  // Videos watched before joining count as done, so a plan starts where you
  // actually are rather than at video one.
  const watched = new Set<string | null>([
    ...tasks.filter((task) => task.logs.some((log) => log.completed)).map((t) => t.youtubeVideoId),
    ...priorProgress.map((row) => row.videoId),
  ]);

  /*
   * Future placeholders are disposable: they carry no log and exist only to
   * show the plan. Clearing them before regenerating is what lets the schedule
   * cascade instead of accumulating stale dates.
   */
  const disposable = tasks.filter(
    (task) =>
      task.logs.length === 0 &&
      task.scheduledDate &&
      dateToDayKey(task.scheduledDate) > input.todayKey,
  );

  if (disposable.length > 0) {
    await db.task.deleteMany({ where: { id: { in: disposable.map((task) => task.id) } } });
  }

  // Anything already sitting on today stays put, so a part-done day is stable.
  const scheduledToday = new Set(
    tasks
      .filter(
        (task) =>
          task.scheduledDate &&
          dateToDayKey(task.scheduledDate) === input.todayKey &&
          !task.archivedAt,
      )
      .map((task) => task.youtubeVideoId),
  );

  const queue = playlist.videos.filter(
    (video) => video.available && !watched.has(video.id) && !scheduledToday.has(video.id),
  );

  const created: { videoId: string; date: DayKey }[] = [];
  let cursor = 0;

  for (let offset = 0; offset <= DAYS_AHEAD && cursor < queue.length; offset++) {
    const date = shiftDayKey(input.todayKey, offset);
    const alreadyOnDay = offset === 0 ? scheduledToday.size : 0;

    for (let slot = alreadyOnDay; slot < playlist.videosPerDay && cursor < queue.length; slot++) {
      created.push({ videoId: queue[cursor].id, date });
      cursor += 1;
    }
  }

  if (created.length > 0) {
    const label = playlist.title.slice(0, 24);
    const lastOrder = await db.task.findFirst({
      where: { ownerUserId: input.userId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    const videoById = new Map(playlist.videos.map((video) => [video.id, video]));

    await db.task.createMany({
      data: created.map((entry, index) => {
        const video = videoById.get(entry.videoId)!;
        return {
          name: video.title.slice(0, 60),
          category: "CUSTOM" as const,
          customLabel: label,
          dayType: "ONE_OFF" as const,
          scheduledDate: dayKeyToDate(entry.date),
          youtubeVideoId: video.id,
          ownerUserId: input.userId,
          createdByUserId: input.userId,
          isCore: playlist.isCore,
          sortOrder: (lastOrder?.sortOrder ?? 0) + index + 1,
        };
      }),
    });
  }

  return { ok: true, scheduled: created.length, remaining: queue.length };
}

/** Removes the plan's future placeholders without touching anything logged. */
export async function clearFutureWatchTasks(input: {
  userId: string;
  playlistId: string;
  todayKey: DayKey;
}) {
  const videos = await db.youtubeVideo.findMany({
    where: { playlistId: input.playlistId },
    select: { id: true },
  });

  const tasks = await db.task.findMany({
    where: {
      ownerUserId: input.userId,
      youtubeVideoId: { in: videos.map((video) => video.id) },
      scheduledDate: { gt: dayKeyToDate(input.todayKey) },
    },
    select: { id: true, logs: { select: { id: true } } },
  });

  const removable = tasks.filter((task) => task.logs.length === 0).map((task) => task.id);
  if (removable.length > 0) await db.task.deleteMany({ where: { id: { in: removable } } });

  return { cleared: removable.length };
}
