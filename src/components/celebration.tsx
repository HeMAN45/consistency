"use client";

import { useEffect, useState } from "react";

import type { ProgressEvents } from "@/app/(app)/actions";
import { Button } from "@/components/ui/button";

/**
 * One overlay, three moments: rank up, perfect day, achievement unlocked.
 * Restrained on purpose — a short reveal, not confetti (PRD §27).
 */
export function Celebration({
  events,
  onDismiss,
}: {
  events: ProgressEvents | null;
  onDismiss: () => void;
}) {
  const [visible, setVisible] = useState(false);

  const hasSomething = Boolean(
    events && (events.rankUp || events.perfectDay || events.unlocked?.length),
  );

  useEffect(() => {
    if (!hasSomething) return;
    setVisible(true);

    // Perfect-day-only moments fade themselves; rank ups wait to be dismissed.
    if (events?.rankUp || events?.unlocked?.length) return;
    const timer = setTimeout(() => {
      setVisible(false);
      onDismiss();
    }, 2600);
    return () => clearTimeout(timer);
  }, [hasSomething, events, onDismiss]);

  if (!hasSomething || !visible) return null;

  function close() {
    setVisible(false);
    onDismiss();
  }

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Progress update"
      className="fixed inset-0 z-50 flex items-center justify-center bg-void/80 px-5 backdrop-blur-sm"
      onClick={close}
    >
      <div
        className="card rise w-full max-w-sm p-7 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {events?.rankUp ? (
          <>
            <p className="font-data text-[11px] tracking-[0.3em] text-amber">RANK UP</p>
            <p className="font-data mt-5 text-lg text-muted">{events.rankUp.from}</p>
            <p className="font-data my-1 text-2xl text-faint">↓</p>
            <p className="font-data text-3xl tracking-tight text-amber">{events.rankUp.to}</p>
            <p className="mt-4 text-sm text-muted">New personal best.</p>
          </>
        ) : events?.perfectDay ? (
          <>
            <p className="font-data text-[11px] tracking-[0.3em] text-good">PERFECT DAY</p>
            <p className="font-data mt-4 text-2xl tracking-tight">Every core task done.</p>
            <p className="mt-3 text-sm text-muted">Streak extended. Rating banked.</p>
          </>
        ) : null}

        {events?.unlocked?.length ? (
          <div className={events.rankUp || events.perfectDay ? "mt-6 border-t border-line pt-5" : ""}>
            <p className="font-data text-[11px] tracking-[0.3em] text-amber">
              {events.unlocked.length > 1 ? "ACHIEVEMENTS" : "ACHIEVEMENT"}
            </p>
            {events.unlocked.map((a) => (
              <div key={a.code} className="mt-3">
                <p className="font-data text-lg tracking-tight">{a.name}</p>
                <p className="mt-1 text-sm text-muted">{a.description}</p>
              </div>
            ))}
          </div>
        ) : null}

        {events?.rankUp || events?.unlocked?.length ? (
          <Button onClick={close} size="sm" className="mt-6">
            Continue
          </Button>
        ) : null}
      </div>
    </div>
  );
}
