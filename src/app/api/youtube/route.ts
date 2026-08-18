import { NextResponse } from "next/server";

import {
  fetchPlaylist,
  fetchSingleVideo,
  parsePlaylistId,
  parseVideoId,
  YoutubeError,
  youtubeConfigured,
} from "@/lib/youtube";
import { playlistStats } from "@/lib/playlist-maths";
import { clientAddress, isRateLimited } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * Public on purpose: the analyzer is the kind of thing people paste a link into
 * and share, and gating it behind a login would cost more than it protects.
 * No user data is touched here, only YouTube's own public metadata.
 */
export async function POST(request: Request) {
  if (!youtubeConfigured()) {
    return NextResponse.json(
      { error: "YouTube isn't configured on this server yet." },
      { status: 503 },
    );
  }

  // Unauthenticated by design, so the quota needs protecting some other way.
  if (await isRateLimited("analyze", clientAddress(request), 30, 60)) {
    return NextResponse.json(
      { error: "That's a lot of playlists. Try again in an hour." },
      { status: 429 },
    );
  }

  let body: { url?: string };
  try {
    body = (await request.json()) as { url?: string };
  } catch {
    return NextResponse.json({ error: "Send a JSON body." }, { status: 400 });
  }

  const url = (body.url ?? "").trim();
  if (!url) return NextResponse.json({ error: "Paste a YouTube link." }, { status: 400 });

  const playlistId = parsePlaylistId(url);
  const videoId = playlistId ? null : parseVideoId(url);

  if (!playlistId && !videoId) {
    return NextResponse.json(
      { error: "That doesn't look like a YouTube playlist or video link." },
      { status: 422 },
    );
  }

  try {
    const fetched = playlistId
      ? await fetchPlaylist(playlistId)
      : await fetchSingleVideo(videoId as string);

    return NextResponse.json({
      kind: playlistId ? "PLAYLIST" : "SINGLE",
      playlist: {
        youtubeId: fetched.youtubeId,
        title: fetched.title,
        channelTitle: fetched.channelTitle,
        thumbnailUrl: fetched.thumbnailUrl,
      },
      stats: playlistStats(fetched.videos),
      videos: fetched.videos.map((video) => ({
        youtubeId: video.youtubeId,
        title: video.title,
        position: video.position,
        durationSeconds: video.durationSeconds,
        available: video.available,
      })),
    });
  } catch (error) {
    if (error instanceof YoutubeError) {
      const status = error.kind === "not-found" ? 404 : error.kind === "quota" ? 429 : 502;
      return NextResponse.json({ error: error.message }, { status });
    }

    console.error("youtube analyze failed", error);
    return NextResponse.json({ error: "Could not read that link." }, { status: 500 });
  }
}
