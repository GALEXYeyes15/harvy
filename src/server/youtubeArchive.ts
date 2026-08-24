/** Dev-server helper: YouTube channel uploads via Data API v3. */

export type YoutubeVideoResult = {
  id: string;
  title: string;
  preview: string;
  postDate: string;
  canonicalUrl: string;
  views: number;
  likes: number;
  comments: number;
  creatorName: string;
  handle: string;
  creatorPhotoUrl?: string | null;
  coverImage?: string | null;
};

const MAX_VIDEOS = 50;

function requireYoutubeApiKey(): string {
  const key = process.env.YOUTUBE_API_KEY?.trim() ?? "";
  if (!key) {
    throw new Error("Add YOUTUBE_API_KEY to .env.local to fetch YouTube outliers.");
  }
  return key;
}

export function parseYoutubeChannelInput(raw: string): { handle?: string; channelId?: string } {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("Enter a YouTube channel URL.");
  if (/^UC[\w-]{20,}$/.test(trimmed)) return { channelId: trimmed };
  try {
    const parsed = trimmed.startsWith("http") ? new URL(trimmed) : new URL(`https://${trimmed}`);
    const parts = parsed.pathname.split("/").filter(Boolean);
    const at = parts.find((p) => p.startsWith("@"));
    if (at) return { handle: at.slice(1) };
    if (parts[0] === "channel" && parts[1]) return { channelId: parts[1] };
    if (parts[0] === "c" && parts[1]) return { handle: parts[1] };
    if (parts[0] === "user" && parts[1]) return { handle: parts[1] };
  } catch {
    if (trimmed.startsWith("@")) return { handle: trimmed.slice(1) };
  }
  throw new Error("Use a youtube.com/@handle or /channel/… URL.");
}

async function youtubeGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const key = requireYoutubeApiKey();
  const url = new URL(`https://www.googleapis.com/youtube/v3/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("key", key);
  const response = await fetch(url);
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(detail.trim() || `YouTube API failed (${response.status}).`);
  }
  return (await response.json()) as T;
}

type ChannelListResponse = {
  items?: Array<{
    id?: string;
    snippet?: {
      title?: string;
      customUrl?: string;
      thumbnails?: { default?: { url?: string } };
    };
    contentDetails?: { relatedPlaylists?: { uploads?: string } };
  }>;
};

type PlaylistItemsResponse = {
  items?: Array<{
    contentDetails?: { videoId?: string };
  }>;
};

type VideosListResponse = {
  items?: Array<{
    id?: string;
    snippet?: {
      title?: string;
      description?: string;
      publishedAt?: string;
      thumbnails?: { medium?: { url?: string }; high?: { url?: string } };
    };
    statistics?: {
      viewCount?: string;
      likeCount?: string;
      commentCount?: string;
    };
  }>;
};

async function resolveChannel(sourceUrl: string): Promise<{
  channelId: string;
  title: string;
  handle: string;
  photoUrl: string | null;
  uploadsPlaylistId: string;
}> {
  const input = parseYoutubeChannelInput(sourceUrl);
  let channelResponse: ChannelListResponse;
  if (input.channelId) {
    channelResponse = await youtubeGet<ChannelListResponse>("channels", {
      part: "snippet,contentDetails",
      id: input.channelId,
    });
  } else if (input.handle) {
    channelResponse = await youtubeGet<ChannelListResponse>("channels", {
      part: "snippet,contentDetails",
      forHandle: input.handle,
    });
  } else {
    throw new Error("Could not resolve YouTube channel.");
  }

  const channel = channelResponse.items?.[0];
  const channelId = channel?.id;
  const uploads = channel?.contentDetails?.relatedPlaylists?.uploads;
  if (!channelId || !uploads) {
    throw new Error("YouTube channel not found or has no uploads.");
  }

  const customUrl = channel.snippet?.customUrl ?? "";
  const handle =
    customUrl.startsWith("@")
      ? customUrl
      : `@${input.handle ?? (customUrl.replace(/^@/, "") || channelId)}`;

  return {
    channelId,
    title: channel.snippet?.title ?? handle,
    handle,
    photoUrl: channel.snippet?.thumbnails?.default?.url ?? null,
    uploadsPlaylistId: uploads,
  };
}

export async function fetchYoutubeVideos(sourceUrl: string): Promise<YoutubeVideoResult[]> {
  const channel = await resolveChannel(sourceUrl);
  const playlist = await youtubeGet<PlaylistItemsResponse>("playlistItems", {
    part: "snippet,contentDetails",
    playlistId: channel.uploadsPlaylistId,
    maxResults: String(MAX_VIDEOS),
  });

  const videoIds =
    playlist.items
      ?.map((item) => item.contentDetails?.videoId)
      .filter((id): id is string => Boolean(id)) ?? [];
  if (videoIds.length === 0) return [];

  const videos = await youtubeGet<VideosListResponse>("videos", {
    part: "snippet,statistics",
    id: videoIds.join(","),
  });

  const results: YoutubeVideoResult[] = [];
  for (const video of videos.items ?? []) {
    const id = video.id;
    if (!id) continue;
    const title = (video.snippet?.title ?? "").trim() || "Untitled";
    const preview = (video.snippet?.description ?? "").trim().slice(0, 280) || title;
    const postDate = video.snippet?.publishedAt ?? new Date().toISOString();
    results.push({
      id,
      title,
      preview,
      postDate,
      canonicalUrl: `https://www.youtube.com/watch?v=${id}`,
      views: Number(video.statistics?.viewCount ?? 0) || 0,
      likes: Number(video.statistics?.likeCount ?? 0) || 0,
      comments: Number(video.statistics?.commentCount ?? 0) || 0,
      creatorName: channel.title,
      handle: channel.handle,
      creatorPhotoUrl: channel.photoUrl,
      coverImage:
        video.snippet?.thumbnails?.high?.url ??
        video.snippet?.thumbnails?.medium?.url ??
        null,
    });
  }

  results.sort((a, b) => Date.parse(b.postDate) - Date.parse(a.postDate));
  return results;
}
