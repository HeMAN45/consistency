"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Bird,
  Bug,
  CloudLightning,
  CloudRain,
  Coffee,
  Flame,
  Music2,
  Volume1,
  Volume2,
  VolumeX,
  Waves,
  Wind,
  X,
} from "lucide-react";

import { LAYERS, type LayerId } from "@/lib/ambient-layers";
import { probeAvailable, setLayerVolume, setMasterVolume, stopAll } from "@/lib/ambient";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "consistency:ambient";
const DEFAULT_LEVEL = 0.5;

const ICONS: Record<LayerId, typeof CloudRain> = {
  rain: CloudRain,
  thunder: CloudLightning,
  waves: Waves,
  wind: Wind,
  fire: Flame,
  crickets: Bug,
  birds: Bird,
  people: Coffee,
};

type Mix = Partial<Record<LayerId, number>>;

/**
 * Tiles rather than a stack of sliders: tapping a sound is the common action,
 * and adjusting its level is the rare one, so the tap target is the whole tile
 * and the slider only appears once a sound is on.
 */
export function AmbientPlayer() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [available, setAvailable] = useState<LayerId[] | null>(null);
  const [mix, setMix] = useState<Mix>({});
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.9);
  const restored = useRef(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open || available !== null) return;
    void probeAvailable().then(setAvailable);
  }, [open, available]);

  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { mix: Mix; volume: number };
        setMix(saved.mix ?? {});
        setVolume(saved.volume ?? 0.9);
      }
    } catch {
      // Nothing saved, or storage blocked.
    }
  }, []);

  const activeCount = Object.values(mix).filter((value) => (value ?? 0) > 0).length;

  function persist(nextMix: Mix, nextVolume: number) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ mix: nextMix, volume: nextVolume }));
    } catch {
      // Not important enough to interrupt anyone.
    }
  }

  function change(id: LayerId, value: number) {
    const next = { ...mix, [id]: value };
    setMix(next);
    void setLayerVolume(id, muted ? 0 : value);
    persist(next, volume);
  }

  function toggle(id: LayerId) {
    const current = mix[id] ?? 0;
    change(id, current > 0 ? 0 : DEFAULT_LEVEL);
  }

  function changeMaster(value: number) {
    setVolume(value);
    setMuted(false);
    setMasterVolume(value);
    persist(mix, value);
  }

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    setMasterVolume(next ? 0 : volume);
  }

  function clear() {
    setMix({});
    setMuted(false);
    stopAll();
    persist({}, volume);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Ambient sound"
        aria-expanded={open}
        className={cn(
          "relative flex h-8 w-8 items-center justify-center rounded-md border transition-colors",
          activeCount > 0
            ? "border-amber/50 text-amber"
            : "border-line text-muted hover:border-line-strong hover:text-ink",
        )}
      >
        <Music2 size={15} />
        {activeCount > 0 && !muted ? (
          <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-amber" />
        ) : null}
      </button>

      {open && mounted
        ? createPortal(
            <div
              className="fixed inset-0 z-[60] flex items-end justify-center bg-void/70 backdrop-blur-sm sm:items-center"
              onClick={() => setOpen(false)}
            >
              <div
                className="card w-full max-w-md p-5 sm:p-6"
                onClick={(event) => event.stopPropagation()}
                style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.25rem)" }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-data text-[11px] tracking-widest text-muted">AMBIENT</p>
                    <p className="mt-0.5 text-xs text-faint">
                      {activeCount === 0
                        ? "Nothing playing"
                        : `${activeCount} playing${muted ? " · muted" : ""}`}
                    </p>
                  </div>
                  <button type="button" onClick={() => setOpen(false)} aria-label="Close">
                    <X size={16} className="text-muted hover:text-ink" />
                  </button>
                </div>

                {available === null ? (
                  <p className="mt-5 text-sm text-muted">Looking for sound files…</p>
                ) : available.length === 0 ? (
                  <div className="mt-5">
                    <p className="text-sm text-ink-soft">No sound files found.</p>
                    <p className="mt-2 text-sm text-muted">
                      Put audio files in <code className="font-data text-xs">public/sounds/</code>{" "}
                      named after the sound: rain, thunder, waves, wind, fire, crickets, birds,
                      people.
                    </p>
                  </div>
                ) : (
                  <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {LAYERS.filter((layer) => available.includes(layer.id)).map((layer) => {
                      const value = mix[layer.id] ?? 0;
                      const on = value > 0;
                      const Icon = ICONS[layer.id];

                      return (
                        <div
                          key={layer.id}
                          className={cn(
                            "rounded-lg border p-3 transition-colors",
                            on ? "border-amber/50 bg-amber/10" : "border-line",
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => toggle(layer.id)}
                            aria-pressed={on}
                            className="flex w-full flex-col items-center gap-2"
                          >
                            <Icon
                              size={20}
                              strokeWidth={1.6}
                              className={on ? "text-amber" : "text-muted"}
                            />
                            <span
                              className={cn(
                                "font-data text-[10px] tracking-wide",
                                on ? "text-ink" : "text-muted",
                              )}
                            >
                              {layer.label}
                            </span>
                          </button>

                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={Math.round(value * 100)}
                            onChange={(event) =>
                              change(layer.id, Number(event.target.value) / 100)
                            }
                            aria-label={`${layer.label} level`}
                            className={cn(
                              "mt-2.5 h-1 w-full cursor-pointer appearance-none rounded-full outline-none transition-opacity",
                              on ? "bg-raised opacity-100" : "bg-raised opacity-30",
                              "[&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-amber",
                              "[&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-amber",
                            )}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="mt-5 flex items-center gap-3 border-t border-line pt-4">
                  <button
                    type="button"
                    onClick={toggleMute}
                    aria-label={muted ? "Unmute" : "Mute"}
                    className={muted ? "text-bad" : "text-muted hover:text-ink"}
                  >
                    {muted ? (
                      <VolumeX size={16} />
                    ) : volume < 0.4 ? (
                      <Volume1 size={16} />
                    ) : (
                      <Volume2 size={16} />
                    )}
                  </button>

                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round((muted ? 0 : volume) * 100)}
                    onChange={(event) => changeMaster(Number(event.target.value) / 100)}
                    aria-label="Overall volume"
                    className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-raised outline-none [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-ink-soft [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-ink-soft"
                  />

                  <button
                    type="button"
                    onClick={clear}
                    disabled={activeCount === 0}
                    className={cn(
                      "font-data text-[10px] tracking-widest",
                      activeCount === 0 ? "text-faint opacity-40" : "text-faint hover:text-bad",
                    )}
                  >
                    CLEAR
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
