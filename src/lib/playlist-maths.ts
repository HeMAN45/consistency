/**
 * Pure playlist arithmetic: runtime at different speeds, pace, finish dates,
 * and how far behind a plan has slipped.
 *
 * Kept free of the database import so it can be unit tested.
 */

export const SPEEDS = [1, 1.25, 1.5, 1.75, 2] as const;
export type Speed = (typeof SPEEDS)[number];

export type VideoLike = { durationSeconds: number; available: boolean };

export function totalSeconds(videos: VideoLike[]) {
  return videos.filter((video) => video.available).reduce((sum, v) => sum + v.durationSeconds, 0);
}

export function atSpeed(seconds: number, speed: Speed) {
  return Math.round(seconds / speed);
}

/** "4h 12m", "12m 30s", "0m". Rounded, never a bare seconds count over a minute. */
export function formatDuration(seconds: number) {
  if (seconds <= 0) return "0m";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${rest}s`;
  return `${rest}s`;
}

export type PlaylistStats = {
  count: number;
  available: number;
  unavailable: number;
  totalSeconds: number;
  averageSeconds: number;
  longestSeconds: number;
  shortestSeconds: number;
  bySpeed: { speed: Speed; seconds: number }[];
};

export function playlistStats(videos: VideoLike[]): PlaylistStats {
  const usable = videos.filter((video) => video.available);
  const durations = usable.map((video) => video.durationSeconds);
  const total = durations.reduce((sum, value) => sum + value, 0);

  return {
    count: videos.length,
    available: usable.length,
    unavailable: videos.length - usable.length,
    totalSeconds: total,
    averageSeconds: usable.length ? Math.round(total / usable.length) : 0,
    longestSeconds: durations.length ? Math.max(...durations) : 0,
    shortestSeconds: durations.length ? Math.min(...durations) : 0,
    bySpeed: SPEEDS.map((speed) => ({ speed, seconds: atSpeed(total, speed) })),
  };
}

/** Days needed to clear `remaining` videos at `perDay`. */
export function daysNeeded(remaining: number, perDay: number) {
  if (perDay <= 0) return Infinity;
  return Math.ceil(remaining / perDay);
}

/**
 * Finish date is always derived from what is still unwatched, never stored.
 * Fall behind and it moves, which is the point: the slipping date is the
 * consequence you are meant to feel.
 */
export function finishDayKey(todayKey: string, remaining: number, perDay: number): string | null {
  const days = daysNeeded(remaining, perDay);
  if (!Number.isFinite(days)) return null;
  if (days <= 0) return todayKey;

  const start = Date.parse(`${todayKey}T00:00:00.000Z`);
  const finish = new Date(start + (days - 1) * 86_400_000);
  return finish.toISOString().slice(0, 10);
}

/**
 * How far behind the original plan you are. Expected progress is measured from
 * the start date at the chosen pace; anything less is a backlog.
 */
export function behindBy(input: {
  startDayKey: string;
  todayKey: string;
  perDay: number;
  watched: number;
  total: number;
}) {
  const elapsedDays =
    Math.round(
      (Date.parse(`${input.todayKey}T00:00:00.000Z`) -
        Date.parse(`${input.startDayKey}T00:00:00.000Z`)) /
        86_400_000,
    ) + 1;

  if (elapsedDays <= 0) return 0;

  const expected = Math.min(input.total, elapsedDays * input.perDay);
  return Math.max(0, expected - input.watched);
}
