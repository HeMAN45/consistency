import type { Metadata } from "next";
import Link from "next/link";

import { ArchivedSyncs } from "@/components/archive-panel";
import { listArchivedDays, listArchivedSyncs } from "@/lib/archive";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Archive · ~/consistency" };

export default async function ArchivePage() {
  const user = await requireUser();

  const [syncs, days] = await Promise.all([
    listArchivedSyncs(user.id, user.timezone),
    listArchivedDays(user.id, user.timezone, 60),
  ]);

  const tracked = days.filter((day) => day.hadData);

  return (
    <div className="rise space-y-8">
      <header>
        <h1 className="font-data text-2xl tracking-tight">Archive</h1>
        <p className="mt-1 text-sm text-muted">
          Finished seasons and every day you logged, kept as a record rather than deleted.
        </p>
      </header>

      <section>
        <p className="font-data text-[11px] tracking-widest text-muted">FINISHED SYNCS</p>
        <div className="mt-3">
          <ArchivedSyncs syncs={syncs} />
        </div>
      </section>

      <section>
        <div className="flex items-baseline justify-between">
          <p className="font-data text-[11px] tracking-widest text-muted">YOUR DAYS</p>
          <p className="font-data text-[11px] text-faint">{tracked.length} tracked</p>
        </div>

        {tracked.length === 0 ? (
          <div className="card mt-3 p-6">
            <p className="text-sm text-ink">No history yet.</p>
            <p className="mt-1 text-sm text-muted">
              Complete a task and the day appears here, with what you finished and what you
              didn&apos;t.
            </p>
          </div>
        ) : (
          <ul className="mt-3 space-y-1">
            {days
              .filter((day) => day.hadData || day.restDay)
              .map((day) => (
                <li key={day.date}>
                  <Link
                    href={`/archive/${day.date}`}
                    className="flex items-center gap-3 rounded-md border border-line px-3 py-2.5 hover:border-line-strong"
                  >
                    <span className="font-data w-28 shrink-0 text-sm text-ink-soft">
                      {day.label}
                    </span>

                    {day.restDay ? (
                      <span className="font-data flex-1 text-[10px] tracking-widest text-muted">
                        REST DAY
                      </span>
                    ) : (
                      <>
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-raised">
                          <span
                            className={cn(
                              "block h-full rounded-full",
                              day.perfectDay ? "bg-good" : "bg-amber",
                            )}
                            style={{ width: `${day.completionPct * 100}%` }}
                          />
                        </span>

                        <span className="font-data w-16 shrink-0 text-right text-xs tabular-nums text-muted">
                          {day.coreCompleted} / {day.coreTotal}
                        </span>
                      </>
                    )}

                    <span
                      className={cn(
                        "font-data w-10 shrink-0 text-right text-xs tabular-nums",
                        day.perfectDay ? "text-good" : "text-faint",
                      )}
                    >
                      {day.restDay ? "—" : `${Math.round(day.completionPct * 100)}%`}
                    </span>
                  </Link>
                </li>
              ))}
          </ul>
        )}
      </section>
    </div>
  );
}
