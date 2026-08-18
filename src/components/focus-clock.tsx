"use client";

import { useEffect, useRef, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";

import { cn } from "@/lib/utils";

export type ClockStyle = "plain" | "flip";

function parts(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return {
    mm: String(minutes).padStart(2, "0"),
    ss: String(seconds).padStart(2, "0"),
  };
}

/**
 * A flip card animates only when its own digit changes, so the minutes card
 * stays still for a whole minute while the seconds card turns. Animating both
 * every tick is what makes most web flip clocks feel wrong.
 */
function FlipCard({ value, label }: { value: string; label: string }) {
  const [display, setDisplay] = useState(value);
  const [flipping, setFlipping] = useState(false);
  const previous = useRef(value);

  useEffect(() => {
    if (value === previous.current) return;
    previous.current = value;
    setFlipping(true);
    const timer = setTimeout(() => {
      setDisplay(value);
      setFlipping(false);
    }, 130);
    return () => clearTimeout(timer);
  }, [value]);

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={cn(
          "relative overflow-hidden rounded-lg border border-line bg-raised",
          "px-[0.18em] py-[0.06em] transition-transform duration-150",
          flipping && "scale-y-95",
        )}
        style={{ transformOrigin: "center" }}
      >
        <span aria-hidden className="absolute inset-x-0 top-1/2 h-px bg-line" />
        <span className="font-data block leading-none tabular-nums">{flipping ? previous.current : display}</span>
      </div>
      <span className="font-data text-[10px] tracking-[0.3em] text-faint">{label}</span>
    </div>
  );
}

export function FocusClock({
  remaining,
  style,
  onStyleChange,
  label,
  plannedMinutes,
  progress,
  children,
}: {
  remaining: number;
  style: ClockStyle;
  onStyleChange: (next: ClockStyle) => void;
  label: string;
  plannedMinutes: number;
  progress: number;
  children: React.ReactNode;
}) {
  const shellRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    function onChange() {
      setFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await shellRef.current?.requestFullscreen();
    } catch {
      // Refused, usually iOS Safari. The timer still runs.
    }
  }

  const { mm, ss } = parts(remaining);

  return (
    <section
      ref={shellRef}
      className={cn(
        "card p-8 text-center",
        fullscreen && "flex h-full w-full flex-col items-center justify-center rounded-none border-0",
      )}
    >
      <div className="flex items-center justify-between">
        <p className="font-data text-[11px] tracking-widest text-muted">
          {label.toUpperCase()} · {plannedMinutes} MIN
        </p>

        <div className="flex items-center gap-1">
          <div className="flex gap-1 rounded-md border border-line p-0.5">
            {(["plain", "flip"] as ClockStyle[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => onStyleChange(option)}
                aria-pressed={style === option}
                className={cn(
                  "font-data rounded px-2 py-0.5 text-[10px] tracking-widest transition-colors",
                  style === option ? "bg-raised text-amber" : "text-muted hover:text-ink",
                )}
              >
                {option === "plain" ? "PLAIN" : "FLIP"}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => void toggleFullscreen()}
            aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-line text-muted hover:border-line-strong hover:text-ink"
          >
            {fullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
        </div>
      </div>

      {style === "flip" ? (
        <div
          className={cn(
            "mt-8 flex items-start justify-center gap-3",
            fullscreen ? "text-[22vw] sm:text-[15vw]" : "text-6xl sm:text-7xl",
          )}
        >
          <FlipCard value={mm} label="MIN" />
          <span className="font-data mt-[0.06em] leading-none text-faint">:</span>
          <FlipCard value={ss} label="SEC" />
        </div>
      ) : (
        <p
          className={cn(
            "font-data mt-8 leading-none tracking-tight tabular-nums",
            fullscreen ? "text-[26vw] sm:text-[18vw]" : "text-5xl sm:text-6xl",
          )}
        >
          {mm}:{ss}
        </p>
      )}

      <div
        className={cn(
          "mx-auto mt-8 h-1 w-full overflow-hidden rounded-full bg-raised",
          fullscreen ? "max-w-2xl" : "max-w-xs",
        )}
      >
        <div
          className="h-full bg-amber transition-[width] duration-1000"
          style={{ width: `${Math.min(100, progress * 100)}%` }}
        />
      </div>

      <div className="mt-8">{children}</div>
    </section>
  );
}
