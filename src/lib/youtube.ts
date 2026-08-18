/**
 * YouTube Data API v3 client.
 *
 * Metadata only: titles, ids and durations. Nothing is downloaded and nothing
 * is embedded here. Unavailable items are reported rather than dropped, because
 * a playlist that silently loses deleted videos gives you a total runtime that
 * is quietly wrong.
 */

const API = "https://www.googleapis.com/youtube/v3";
const PAGE_SIZE = 50;

export type FetchedVideo = {
  youtubeId: string;
  title: string;
  position: number;
  durationSeconds: number;
  thumbnailUrl: string | null;
  available: boolean;
};

export type FetchedPlaylist = {
  youtubeId: string;
  title: string;
  channelTitle: string | null;
  thumbnailUrl: string | null;
  videos: FetchedVideo[];
};

export class YoutubeError extends Error {
  constructor(
    message: string,
    readonly kind: "config" | "not-found" | "quota" | "network",
  ) {
    super(message);
    this.name = "YoutubeError";
  }
}

export function youtubeConfigured() {
  return Boolean(process.env.YOUTUBE_API_KEY);
}

/** Accepts a full URL, a share link, or a bare id. */
export function parsePlaylistId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (/^PL[\w-]{10,}$/.test(trimmed) || /^(UU|OL|FL|LL|RD)[\w-]{10,}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    const list = url.searchParams.get("list");
    if (list) return list;
  } catch {
    // Not a URL. Fall through.
  }

  return null;
}

export function parseVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (/^[\w-]{11}$/.test(trimmed)) return trimmed;

  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);

    if (url.hostname === "youtu.be") {
      const id = url.pathname.slice(1);
      return /^[\w-]{11}$/.test(id) ? id : null;
    }

    const v = url.searchParams.get("v");
    if (v && /^[\w-]{11}$/.test(v)) return v;

    // /shorts/ID and /embed/ID
    const match = url.pathname.match(/\/(shorts|embed|v)\/([\w-]{11})/);
    if (match) return match[2];
  } catch {
    // Not a URL.
  }

  return null;
}

/** ISO 8601 duration, e.g. PT1H2M10S. Returns whole seconds. */
export function parseIsoDuration(value: string): number {
  const match = value.match(/^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return 0;

  const [, days, hours, minutes, seconds] = match;
  return (
    Number(days ?? 0) * 86400 +
    Number(hours ?? 0) * 3600 +
    Number(minutes ?? 0) * 60 +
    Number(seconds ?? 0)
  );
}

async function call<T>(path: string, params: Record<string, string>): Promise<T> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    throw new YoutubeError("YOUTUBE_API_KEY is not set on this server.", "config");
  }

  const url = new URL(`${API}/${path}`);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  url.searchParams.set("key", key);

  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store" });
  } catch {
    throw new YoutubeError("Could not reach YouTube.", "network");
  }

  if (response.status === 403) {
    const body = await response.text().catch(() => "");
    throw new YoutubeError(
      body.includes("quota")
        ? "YouTube's daily quota is used up. Try again tomorrow."
        : "YouTube refused the request. Check the API key and its restrictions.",
      "quota",
    );
  }

  if (response.status === 404) throw new YoutubeError("Not found on YouTube.", "not-found");

  if (!response.ok) {
    throw new YoutubeError(`YouTube returned ${response.status}.`, "network");
  }

  return (await response.json()) as T;
}

type PlaylistResponse = {
  items: {
    id: string;
    snippet: {
      title: string;
      channelTitle: string;
      thumbnails?: Record<string, { url: string }>;
    };
  }[];
};

type ItemsResponse = {
  nextPageToken?: string;
  items: {
    snippet: {
      title: string;
      position: number;
      resourceId: { videoId: string };
      thumbnails?: Record<string, { url: string }>;
    };
  }[];
};

type VideosResponse = {
  items: { id: string; contentDetails: { duration: string } }[];
};

function thumbnail(thumbnails?: Record<string, { url: string }>) {
  return (
    thumbnails?.medium?.url ?? thumbnails?.high?.url ?? thumbnails?.default?.url ?? null
  );
}

export async function fetchPlaylist(playlistId: string): Promise<FetchedPlaylist> {
  const meta = await call<PlaylistResponse>("playlists", {
    part: "snippet",
    id: playlistId,
    maxResults: "1",
  });

  const playlist = meta.items[0];
  if (!playlist) {
    throw new YoutubeError("No playlist with that link. Private playlists can't be read.", "not-found");
  }

  // Page through the items. A 100-video playlist is two calls.
  const rawItems: ItemsResponse["items"] = [];
  let pageToken: string | undefined;

  do {
    const page: ItemsResponse = await call<ItemsResponse>("playlistItems", {
      part: "snippet",
      playlistId,
      maxResults: String(PAGE_SIZE),
      ...(pageToken ? { pageToken } : {}),
    });

    rawItems.push(...page.items);
    pageToken = page.nextPageToken;
  } while (pageToken && rawItems.length < 1000);

  // Durations come from a separate endpoint, 50 ids at a time.
  const ids = rawItems.map((item) => item.snippet.resourceId?.videoId).filter(Boolean);
  const durations = new Map<string, number>();

  for (let i = 0; i < ids.length; i += PAGE_SIZE) {
    const chunk = ids.slice(i, i + PAGE_SIZE);
    const details = await call<VideosResponse>("videos", {
      part: "contentDetails",
      id: chunk.join(","),
    });

    for (const item of details.items) {
      durations.set(item.id, parseIsoDuration(item.contentDetails.duration));
    }
  }

  const videos: FetchedVideo[] = rawItems.map((item, index) => {
    const youtubeId = item.snippet.resourceId?.videoId ?? "";
    // A deleted or privated video still occupies a position, but returns no
    // details. Marked unavailable so totals stay truthful.
    const available = durations.has(youtubeId);

    return {
      youtubeId,
      title: item.snippet.title,
      position: item.snippet.position ?? index,
      durationSeconds: durations.get(youtubeId) ?? 0,
      thumbnailUrl: thumbnail(item.snippet.thumbnails),
      available,
    };
  });

  return {
    youtubeId: playlistId,
    title: playlist.snippet.title,
    channelTitle: playlist.snippet.channelTitle ?? null,
    thumbnailUrl: thumbnail(playlist.snippet.thumbnails),
    videos: videos.filter((video) => video.youtubeId),
  };
}

export async function fetchSingleVideo(videoId: string): Promise<FetchedPlaylist> {
  const details = await call<VideosResponse & PlaylistResponse>("videos", {
    part: "snippet,contentDetails",
    id: videoId,
  });

  const item = details.items[0] as
    | (VideosResponse["items"][number] & PlaylistResponse["items"][number])
    | undefined;

  if (!item) throw new YoutubeError("No video with that link.", "not-found");

  return {
    youtubeId: videoId,
    title: item.snippet.title,
    channelTitle: item.snippet.channelTitle ?? null,
    thumbnailUrl: thumbnail(item.snippet.thumbnails),
    videos: [
      {
        youtubeId: videoId,
        title: item.snippet.title,
        position: 0,
        durationSeconds: parseIsoDuration(item.contentDetails.duration),
        thumbnailUrl: thumbnail(item.snippet.thumbnails),
        available: true,
      },
    ],
  };
}
