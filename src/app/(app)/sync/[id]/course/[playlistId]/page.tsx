import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SyncCoursePlanner } from "@/components/sync-course-planner";
import { VideoRow } from "@/components/video-row";
import { formatDuration } from "@/lib/playlist-maths";
import { requireUser } from "@/lib/session";
import { loadSyncPlaylist } from "@/lib/sync-playlists";
import { todayKey } from "@/lib/time";

export const metadata: Metadata = { title: "Course · ~/consistency" };

export default async function SyncCoursePage({
  params,
}: {
  params: Promise<{ id: string; playlistId: string }>;
}) {
  const { id, playlistId } = await params;
  const user = await requireUser();

  const course = await loadSyncPlaylist(playlistId, user.id);
  if (!course || course.syncId !== id) notFound();

  const today = todayKey(user.timezone);
  const usable = course.videos.filter((video) => video.available);
  const remaining = usable.filter((video) => !video.watched);
  const remainingSeconds = remaining.reduce((sum, video) => sum + video.durationSeconds, 0);

  return (
    <div className="rise space-y-5">
      <header>
        <Link href={`/sync/${id}`} className="font-data text-xs text-muted hover:text-ink">
          ← Back to the SYNC
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-[-0.02em]">{course.title}</h1>
        <p className="font-data mt-1 text-[10px] tracking-widest text-faint">
          {course.sharedSchedule ? "ONE SCHEDULE FOR EVERYONE" : "EACH MEMBER AT THEIR OWN PACE"}
        </p>
      </header>

      <section className="card p-5">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="YOU'VE DONE" value={`${usable.length - remaining.length} / ${usable.length}`} />
          <Stat label="LEFT" value={formatDuration(remainingSeconds)} />
          <Stat label="PACE" value={`${course.videosPerDay}/day`} />
          <Stat label="COUNTS" value={course.isCore ? "Core" : "Bonus"} />
        </div>
      </section>

      <SyncCoursePlanner
        playlistId={course.id}
        syncId={id}
        todayKey={today}
        remaining={remaining.length}
        remainingSeconds={remainingSeconds}
        videosPerDay={course.videosPerDay}
        isCore={course.isCore}
        sharedSchedule={course.sharedSchedule}
        canEdit={course.sharedSchedule ? course.isOwner : true}
        isOwner={course.isOwner}
      />

      <section className="card p-5">
        <p className="font-data text-[11px] tracking-widest text-muted">VIDEOS</p>

        <ol className="mt-3">
          {course.videos.map((video) => (
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
