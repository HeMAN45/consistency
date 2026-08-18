import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CatchUp } from "@/components/catch-up";
import { PlaylistPlanner } from "@/components/playlist-planner";
import { VideoRow } from "@/components/video-row";
import { formatDuration, playlistStats } from "@/lib/playlist-maths";
import { loadPlaylist } from "@/lib/playlists";
import { requireUser } from "@/lib/session";
import { todayKey } from "@/lib/time";

export const metadata: Metadata = { title: "Playlist · ~/consistency" };

function formatDayLabel(key: string) {
  return new Date(`${key}T00:00:00.000Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export default async function PlaylistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const playlist = await loadPlaylist(id, user.id);
  if (!playlist) notFound();

  const today = todayKey(user.timezone);
  const stats = playlistStats(playlist.videos);

  const watched = playlist.videos.filter((video) => video.watched);
  const remaining = playlist.videos.filter((video) => video.available && !video.watched);
  const remainingSeconds = remaining.reduce((sum, video) => sum + video.durationSeconds, 0);
  const scheduled = playlist.videos.filter(
    (video) => video.scheduledFor && video.scheduledFor > today,
  );

  return (
    <div className="rise space-y-5">
      <header>
        <Link href="/watch" className="font-data text-xs text-muted hover:text-ink">
          ← Watch
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-[-0.02em]">{playlist.title}</h1>
        {playlist.channelTitle ? (
          <p className="mt-1 text-sm text-muted">{playlist.channelTitle}</p>
        ) : null}
      </header>

      <section className="card p-5">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="WATCHED" value={`${watched.length} / ${stats.available}`} />
          <Stat label="LEFT" value={formatDuration(remainingSeconds)} />
          <Stat label="TOTAL" value={formatDuration(stats.totalSeconds)} />
          <Stat label="AT 1.5x" value={formatDuration(Math.round(remainingSeconds / 1.5))} />
        </div>

        <div className="mt-5 border-t border-line pt-4">
          <CatchUp
            playlistId={playlist.id}
            total={playlist.videos.length}
            watched={watched.length}
          />
        </div>

        {stats.unavailable > 0 ? (
          <p className="mt-4 text-xs text-warn">
            {stats.unavailable} video{stats.unavailable === 1 ? " is" : "s are"} deleted or private.
            Excluded from every total and never scheduled.
          </p>
        ) : null}
      </section>

      <PlaylistPlanner
        playlistId={playlist.id}
        todayKey={today}
        remaining={remaining.length}
        remainingSeconds={remainingSeconds}
        videosPerDay={playlist.videosPerDay}
        isCore={playlist.isCore}
        scheduledCount={scheduled.length}
      />

      <section className="card p-5">
        <div className="flex items-baseline justify-between">
          <p className="font-data text-[11px] tracking-widest text-muted">VIDEOS</p>
          <p className="font-data text-[11px] text-faint">{playlist.videos.length}</p>
        </div>

        <ol className="mt-3">
          {playlist.videos.map((video) => (
            <VideoRow
              key={video.id}
              id={video.id}
              position={video.position}
              title={video.title}
              durationSeconds={video.durationSeconds}
              available={video.available}
              watched={video.watched}
              scheduledFor={video.scheduledFor}
              todayKey={today}
            />
          ))}
        </ol>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-data text-[10px] tracking-widest text-faint">{label}</p>
      <p className="font-data mt-1 text-lg">{value}</p>
    </div>
  );
}
