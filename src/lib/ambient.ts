"use client";

/**
 * Ambient sound from real loop files in /public/sounds.
 *
 * Synthesis was tried first and rejected: filtered noise gets the spectrum
 * roughly right and the texture completely wrong, so rain came out as tinted
 * static. Recordings are the only way this sounds like what it claims to be.
 *
 * Loaded through Web Audio rather than <audio> elements, because
 * `decodeAudioData` plus a looping buffer source gives a seamless loop, while
 * an <audio> loop has an audible gap at the seam.
 *
 * A layer whose file is absent is reported unavailable and hidden from the
 * mixer, so files can be added one at a time.
 */

export { LAYERS, type LayerId } from "@/lib/ambient-layers";
import type { LayerId } from "@/lib/ambient-layers";

type Layer = {
  source: AudioBufferSourceNode;
  gain: GainNode;
};

let context: AudioContext | null = null;
let master: GainNode | null = null;
const layers = new Map<LayerId, Layer>();
const buffers = new Map<LayerId, AudioBuffer>();
const loading = new Map<LayerId, Promise<AudioBuffer | null>>();

export function ensureContext() {
  if (!context) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    context = new Ctor();
    master = context.createGain();
    master.gain.value = 0.9;
    master.connect(context.destination);
  }
  if (context.state === "suspended") void context.resume();
  return { ctx: context, out: master! };
}

const urls = new Map<LayerId, string>();

/** One request, listing exactly which files exist and where. */
export async function probeAvailable(): Promise<LayerId[]> {
  try {
    const response = await fetch("/api/sounds");
    if (!response.ok) return [];

    const body = (await response.json()) as { sounds: { id: LayerId; url: string }[] };
    urls.clear();
    for (const sound of body.sounds) urls.set(sound.id, sound.url);

    return body.sounds.map((sound) => sound.id);
  } catch {
    return [];
  }
}

async function loadBuffer(id: LayerId): Promise<AudioBuffer | null> {
  const cached = buffers.get(id);
  if (cached) return cached;

  const existing = loading.get(id);
  if (existing) return existing;

  const url = urls.get(id);
  if (!url) return null;

  const attempt = (async () => {
    const { ctx } = ensureContext();
    try {
      const response = await fetch(url);
      if (!response.ok) return null;

      const bytes = await response.arrayBuffer();
      const buffer = await ctx.decodeAudioData(bytes);
      buffers.set(id, buffer);
      return buffer;
    } catch {
      // Undecodable file, e.g. a video container with no audio track.
      return null;
    }
  })();

  loading.set(id, attempt);
  const result = await attempt;
  loading.delete(id);
  return result;
}

/**
 * Target volumes, applied the moment a layer is ready.
 *
 * Dragging a slider fires a change per pixel. Each call used to await the file
 * load and then create its own looping source, stacking several copies of the
 * same sound and leaving mute and clear controlling only some of them. Now the
 * wanted volume is recorded synchronously and one start is allowed per layer.
 */
const wanted = new Map<LayerId, number>();
const starting = new Set<LayerId>();

export async function setLayerVolume(id: LayerId, volume: number) {
  const { ctx, out } = ensureContext();
  wanted.set(id, volume);

  const existing = layers.get(id);
  if (existing) {
    existing.gain.gain.cancelScheduledValues(ctx.currentTime);
    existing.gain.gain.setTargetAtTime(volume, ctx.currentTime, 0.25);
    return;
  }

  if (volume <= 0) return; // don't fetch a file just to silence it
  if (starting.has(id)) return; // a start is already in flight

  starting.add(id);
  try {
    const buffer = await loadBuffer(id);
    if (!buffer) return;

    // The slider may have moved, or been cleared, while the file loaded.
    const target = wanted.get(id) ?? 0;
    if (target <= 0 || layers.has(id)) return;

    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(out);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(gain);
    source.start(0, Math.random() * buffer.duration); // stagger the loop seam

    layers.set(id, { source, gain });
    gain.gain.setTargetAtTime(target, ctx.currentTime, 0.25);
  } finally {
    starting.delete(id);
  }
}

export function setMasterVolume(volume: number) {
  const { ctx, out } = ensureContext();
  out.gain.setTargetAtTime(volume, ctx.currentTime, 0.1);
}

export function stopAll() {
  wanted.clear();

  for (const [, layer] of layers) {
    try {
      layer.source.stop();
      layer.source.disconnect();
      layer.gain.disconnect();
    } catch {
      // Already stopped.
    }
  }
  layers.clear();
  if (context && context.state === "running") void context.suspend();
}

export function resume() {
  const { ctx } = ensureContext();
  if (ctx.state === "suspended") void ctx.resume();
}

export function isPlaying() {
  return context?.state === "running" && layers.size > 0;
}
