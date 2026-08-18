import Link from "next/link";

import type { PlaylistProgress } from "@/lib/watch-progress";

function formatDayLabel(key: string) {
  return new Date(`${key}T00:00:00.000Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/**
 * Only appears when a plan has actually slipped. The point is the moved finish
 * date: a backlog count alone is easy to shrug off, a date you promised
 * yourself and lost is not.
 */
export function BehindSchedule({ playlists }: { playlists: PlaylistProgress[] }) {
  const slipping = playlists.filter((playlist) => playlist.behind > 0 && playlist.remaining > 0);
  if (slipping.length === 0) return null;

  return (
    <section className="card border-warn/30 p-5">
      <p className="font-data text-[11px] tracking-widest text-warn">BEHIND SCHEDULE</p>

      <ul className="mt-3 space-y-3">
        {slipping.map((playlist) => {
          const moved =
            playlist.originalFinish &&
            playlist.projectedFinish &&
            playlist.projectedFinish > playlist.originalFinish;

          return (
            <li key={playlist.id}>
              <Link href={`/watch/${playlist.id}`} className="group block">
                <p className="text-sm text-ink group-hover:text-amber">{playlist.title}</p>
                <p className="mt-0.5 text-sm text-muted">
                  {playlist.behind} video{playlist.behind === 1 ? "" : "s"} behind
                  {moved ? (
                    <>
                      {" · finish moved "}
                      <span className="font-data text-faint line-through">
                        {formatDayLabel(playlist.originalFinish as string)}
                      </span>
                      {" → "}
                      <span className="font-data text-warn">
                        {formatDayLabel(playlist.projectedFinish as string)}
                      </span>
                    </>
                  ) : null}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>

      <p className="mt-4 text-xs text-faint">
        Yesterday&apos;s videos roll forward. The work is still there; only the date moved.
      </p>
    </section>
  );
}
