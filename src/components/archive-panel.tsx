"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import {
  archiveSyncAction,
  deleteSyncAction,
  restoreSyncAction,
} from "@/app/(app)/archive/actions";
import type { ArchivedSync } from "@/lib/archive";
import { cn } from "@/lib/utils";

function formatDayLabel(key: string) {
  return new Date(`${key}T00:00:00.000Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function ArchivedSyncs({ syncs }: { syncs: ArchivedSync[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function run(fn: () => Promise<{ error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (result.error) setError(result.error);
      else {
        setConfirming(null);
        router.refresh();
      }
    });
  }

  if (syncs.length === 0) {
    return (
      <div className="card p-6">
        <p className="text-sm text-ink">Nothing finished yet.</p>
        <p className="mt-1 text-sm text-muted">
          When a season ends, the SYNC lands here with its final standings intact.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error ? (
        <p role="alert" className="text-sm text-bad">
          {error}
        </p>
      ) : null}

      {syncs.map((sync) => (
        <section key={sync.id} className="card p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="min-w-0">
              <Link
                href={`/sync/${sync.id}`}
                className="text-sm font-medium text-ink hover:text-amber"
              >
                {sync.name}
              </Link>
              {sync.goalTitle ? (
                <p className="mt-0.5 text-xs text-muted">{sync.goalTitle}</p>
              ) : null}
            </div>

            <p className="font-data text-[10px] tracking-widest text-faint">
              {sync.archived ? "ARCHIVED" : "SEASON ENDED"}
            </p>
          </div>

          {sync.startDate && sync.endDate ? (
            <p className="font-data mt-1 text-[11px] text-faint">
              {formatDayLabel(sync.startDate)} → {formatDayLabel(sync.endDate)} ·{" "}
              {sync.memberCount} {sync.memberCount === 1 ? "member" : "members"}
            </p>
          ) : null}

          {sync.standings.length > 0 ? (
            <ol className="mt-4 space-y-1.5">
              {sync.standings.map((row, index) => (
                <li key={row.displayName} className="flex items-center gap-3">
                  <span
                    className={cn(
                      "font-data w-5 text-center text-xs tabular-nums",
                      index === 0 ? "text-amber" : "text-faint",
                    )}
                  >
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-ink-soft">
                    {row.displayName}
                  </span>
                  <span className="font-data text-xs tabular-nums text-muted">
                    {row.done} / {row.total}
                  </span>
                  <span className="font-data w-10 text-right text-xs tabular-nums text-faint">
                    {Math.round(row.pct * 100)}%
                  </span>
                </li>
              ))}
            </ol>
          ) : null}

          {sync.isOwner ? (
            <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-line pt-4">
              {sync.archived ? (
                <button
                  type="button"
                  onClick={() => run(() => restoreSyncAction(sync.id))}
                  className="font-data text-[10px] tracking-widest text-muted hover:text-ink"
                >
                  RESTORE
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => run(() => archiveSyncAction(sync.id))}
                  className="font-data text-[10px] tracking-widest text-muted hover:text-ink"
                >
                  ARCHIVE
                </button>
              )}

              {confirming === sync.id ? (
                <span className="flex items-center gap-3">
                  <span className="font-data text-[10px] tracking-widest text-muted">
                    DELETE FOREVER?
                  </span>
                  <button
                    type="button"
                    onClick={() => run(() => deleteSyncAction(sync.id))}
                    className="font-data text-[10px] tracking-widest text-bad"
                  >
                    YES
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming(null)}
                    className="font-data text-[10px] tracking-widest text-faint hover:text-ink"
                  >
                    NO
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirming(sync.id)}
                  className="font-data text-[10px] tracking-widest text-faint hover:text-bad"
                >
                  DELETE
                </button>
              )}
            </div>
          ) : null}
        </section>
      ))}
    </div>
  );
}
