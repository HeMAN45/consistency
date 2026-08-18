"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Play } from "lucide-react";

import { toggleWatchedAction } from "@/app/(app)/watch/watch-actions";
import { formatDuration } from "@/lib/playlist-maths";
import { cn } from "@/lib/utils";

export function VideoRow({
  id,
  position,
  title,
  durationSeconds,
  available,
  watched,
  scheduledFor,
  todayKey,
}: {
  id: string;
  position: number;
  title: string;
  durationSeconds: number;
  available: boolean;
  watched: boolean;
  scheduledFor: string | null;
  todayKey: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      await toggleWatchedAction(id, !watched);
      router.refresh();
    });
  }

  return (
    <li className="flex items-center gap-3 border-b border-line py-2.5 last:border-0">
      <button
        type="button"
        onClick={toggle}
        disabled={pending || !available}
        aria-pressed={watched}
        aria-label={watched ? `Mark ${title} unwatched` : `Mark ${title} watched`}
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors",
          watched
            ? "border-good bg-good/20 text-good"
            : "border-line-strong text-transparent hover:border-amber",
          !available && "opacity-40",
        )}
      >
        <Check size={12} strokeWidth={3} />
      </button>

      <span className="font-data w-6 shrink-0 text-xs tabular-nums text-faint">
        {position + 1}
      </span>

      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate text-sm",
            watched || !available ? "text-faint line-through" : "text-ink-soft",
          )}
        >
          {title}
        </span>

        {scheduledFor && !watched ? (
          <span className="font-data text-[10px] tracking-widest text-faint">
            {scheduledFor === todayKey ? "TODAY" : `SCHEDULED ${scheduledFor}`}
          </span>
        ) : null}
      </span>

      {available && !watched ? (
        <Link
          href={`/watch/v/${id}`}
          className="font-data flex shrink-0 items-center gap-1 text-[10px] tracking-widest text-amber hover:text-amber-soft"
        >
          <Play size={11} /> WATCH
        </Link>
      ) : null}

      <span className="font-data w-14 shrink-0 text-right text-xs tabular-nums text-muted">
        {available ? formatDuration(durationSeconds) : "gone"}
      </span>
    </li>
  );
}
