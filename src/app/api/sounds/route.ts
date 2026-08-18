import { readdir } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { LAYERS } from "@/lib/ambient-layers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AUDIO_EXTENSIONS = new Set([".m4a", ".mp3", ".ogg", ".wav", ".aac", ".mp4", ".webm", ".flac"]);

/**
 * Windows hides extensions by default, so renaming "main-rain" to "rain.m4a"
 * commonly produces "rain.m4a.mp4" on disk. Strip every trailing audio
 * extension, and tolerate a leading "main-", so a file lands in the right slot
 * whatever the rename produced.
 */
function normalise(file: string) {
  let name = file.toLowerCase();

  for (;;) {
    const extension = path.extname(name);
    if (!extension || !AUDIO_EXTENSIONS.has(extension)) break;
    name = path.basename(name, extension);
  }

  return name.replace(/^main[-_]/, "").trim();
}

function hasAudioExtension(file: string) {
  return AUDIO_EXTENSIONS.has(path.extname(file).toLowerCase());
}

/**
 * Reads /public/sounds once and reports what is actually there, with the
 * filename it found, so the client never has to guess an extension.
 *
 * The previous approach guessed extensions with a HEAD request per layer per
 * extension: 32 requests, most of them 404s, and still wrong if someone used an
 * extension I hadn't listed. Reading the directory is one request and cannot
 * guess wrong.
 */
export async function GET() {
  try {
    const directory = path.join(process.cwd(), "public", "sounds");
    const entries = await readdir(directory);

    const found = LAYERS.map((layer) => {
      const match = entries.find(
        (file) => hasAudioExtension(file) && normalise(file) === layer.id,
      );

      return match ? { id: layer.id, url: `/sounds/${encodeURIComponent(match)}` } : null;
    }).filter((entry): entry is { id: string; url: string } => entry !== null);

    return NextResponse.json({ sounds: found });
  } catch {
    // No folder yet. Not an error, just nothing to play.
    return NextResponse.json({ sounds: [] });
  }
}
