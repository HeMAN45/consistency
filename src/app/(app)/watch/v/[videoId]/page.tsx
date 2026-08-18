import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { VideoPlayer } from "@/components/video-player";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Watching · ~/consistency" };

export default async function VideoPage({ params }: { params: Promise<{ videoId: string }> }) {
  const { videoId } = await params;
  const user = await requireUser();

  const video = await db.youtubeVideo.findUnique({
    where: { id: videoId },
    select: {
      id: true,
      youtubeId: true,
      title: true,
      durationSeconds: true,
      available: true,
      playlist: { select: { id: true, title: true, ownerUserId: true } },
      progress: { where: { userId: user.id }, select: { watchedSeconds: true, completedAt: true } },
    },
  });

  if (!video || video.playlist.ownerUserId !== user.id) notFound();

  if (!video.available) {
    return (
      <div className="card p-6">
        <p className="font-data text-[11px] tracking-widest text-warn">UNAVAILABLE</p>
        <h1 className="mt-2 text-lg font-semibold">This video is deleted or private.</h1>
        <p className="mt-2 text-sm text-muted">
          It stays in the list so your totals don&apos;t silently change, but it can&apos;t be
          watched or scheduled.
        </p>
        <Link
          href={`/watch/${video.playlist.id}`}
          className="font-data mt-4 inline-block text-sm text-amber hover:text-amber-soft"
        >
          Back to the playlist
        </Link>
      </div>
    );
  }

  const progress = video.progress[0];

  return (
    <div className="rise space-y-4">
      <header>
        <Link
          href={`/watch/${video.playlist.id}`}
          className="font-data text-xs text-muted hover:text-ink"
        >
          ← {video.playlist.title}
        </Link>
        <h1 className="mt-2 text-lg font-semibold tracking-[-0.02em]">{video.title}</h1>
      </header>

      <VideoPlayer
        videoId={video.id}
        youtubeId={video.youtubeId}
        title={video.title}
        durationSeconds={video.durationSeconds}
        initialSeconds={progress?.watchedSeconds ?? 0}
        alreadyWatched={Boolean(progress?.completedAt)}
      />
    </div>
  );
}
