"use client";

import { useState, useTransition } from "react";

import { tagMissedDayAction } from "@/app/(app)/actions";
import { formatDayKey } from "@/lib/time";
import { cn } from "@/lib/utils";

export type Gap = {
  date: string;
  completionPct: number;
  coreCompleted: number;
  coreTotal: number;
  reason: string | null;
};

const REASONS: { value: string; label: string }[] = [
  { value: "SICK", label: "Unwell" },
  { value: "TRAVEL", label: "Travelling" },
  { value: "OVERLOADED", label: "Too much on" },
  { value: "LOW_ENERGY", label: "No energy" },
  { value: "CHOSE_NOT_TO", label: "Chose not to" },
  { value: "OTHER", label: "Other" },
];

/**
 * Tagging is for your own pattern-spotting. It changes no number anywhere:
 * a reason is not an excuse, and the rating never sees it.
 */
export function GapsCard({ gaps }: { gaps: Gap[] }) {
  const [local, setLocal] = useState(gaps);
  const [, startTransition] = useTransition();

  if (local.length === 0) return null;

  function tag(date: string, reason: string | null) {
    setLocal((prev) => prev.map((g) => (g.date === date ? { ...g, reason } : g)));
    startTransition(async () => {
      await tagMissedDayAction(date, reason);
    });
  }

  return (
    <section className="card p-5">
      <p className="font-data text-[11px] tracking-widest text-muted">GAPS THIS WEEK</p>
      <p className="mt-1 text-xs text-faint">
        Naming what happened builds a pattern you can act on. It changes no score.
      </p>

      <ul className="mt-4 space-y-3">
        {local.map((gap) => (
          <li key={gap.date} className="border-b border-line pb-3 last:border-0 last:pb-0">
            <div className="flex items-baseline justify-between">
              <span className="font-data text-sm">{formatDayKey(gap.date, "EEE d MMM")}</span>
              <span className="font-data text-xs tabular-nums text-faint">
                {gap.coreCompleted}/{gap.coreTotal} core
              </span>
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5">
              {REASONS.map((reason) => {
                const active = gap.reason === reason.value;
                return (
                  <button
                    key={reason.value}
                    type="button"
                    onClick={() => tag(gap.date, active ? null : reason.value)}
                    aria-pressed={active}
                    className={cn(
                      "font-data rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                      active
                        ? "border-amber bg-amber text-void"
                        : "border-line text-muted hover:border-line-strong hover:text-ink",
                    )}
                  >
                    {reason.label}
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
