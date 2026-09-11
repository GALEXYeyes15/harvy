/** Dev-server helper: YouTube channel uploads via Data API v3 or public RSS fallback. */

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
const USER_AGENT = "Harvy/0.1 (YouTube public archive)";

function youtubeApiKey(): string | null {
  const key = process.env.YOUTUBE_API_KEY?.trim() ?? "";
  return key || null;
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

function decodeXml(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function xmlTag(block: string, tag: string): string | null {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeXml(match[1].trim()) : null;
}

function xmlAttr(block: string, tag: string, attr: string): string | null {
  const match = block.match(new RegExp(`<${tag}[^>]*\\s${attr}="([^"]+)"`, "i"));
  return match ? decodeXml(match[1]) : null;
}

function extractChannelIdFromHtml(html: string): string | null {
  const patterns = [
    /"externalId":"(UC[\w-]{22})"/,
    /"browseId":"(UC[\w-]{22})"/,
    /"channelId":"(UC[\w-]{22})"/,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

function extractChannelMetaFromHtml(html: string, fallbackHandle?: string): {
  channelId: string | null;
  title: string | null;
  handle: string | null;
  photoUrl: string | null;
} {
  const channelId = extractChannelIdFromHtml(html);
  const personMatch = html.match(/"@type":"Person"[^}]*"name":"([^"]+)"[^}]*"alternateName":"(@[^"]+)"/);
  const imageMatch = html.match(/"@type":"Person"[^}]*"image":"(https:[^"]+)"/);
  return {
    channelId,
    title: personMatch?.[1] ?? null,
    handle: personMatch?.[2] ?? (fallbackHandle ? `@${fallbackHandle.replace(/^@/, "")}` : null),
    photoUrl: imageMatch?.[1] ?? null,
  };
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xml" },
  });
  if (!response.ok) {
    throw new Error(`YouTube request failed (${response.status}).`);
  }
  return response.text();
}

async function resolveYoutubeChannelPublic(sourceUrl: string): Promise<{
  channelId: string;
  title: string;
  handle: string;
  photoUrl: string | null;
}> {
  const input = parseYoutubeChannelInput(sourceUrl);
  if (input.channelId) {
    const rssXml = await fetchText(
      `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(input.channelId)}`,
    );
    const feedTitle = xmlTag(rssXml, "title") ?? input.channelId;
    return {
      channelId: input.channelId,
      title: feedTitle,
      handle: `@${feedTitle.replace(/\s+/g, "")}`,
      photoUrl: null,
    };
  }

  const handle = input.handle!;
  const pageUrl = `https://www.youtube.com/@${encodeURIComponent(handle)}/videos`;
  const html = await fetchText(pageUrl);
  const meta = extractChannelMetaFromHtml(html, handle);
  if (!meta.channelId) {
    throw new Error("YouTube channel not found.");
  }
  return {
    channelId: meta.channelId,
    title: meta.title ?? handle,
    handle: meta.handle ?? `@${handle}`,
    photoUrl: meta.photoUrl,
  };
}

function parseYoutubeRssEntries(
  xml: string,
  channel: { title: string; handle: string; photoUrl: string | null },
): YoutubeVideoResult[] {
  const results: YoutubeVideoResult[] = [];
  for (const block of xml.split("<entry>").slice(1, MAX_VIDEOS + 1)) {
    const id = xmlTag(block, "yt:videoId");
    if (!id) continue;
    const title = xmlTag(block, "title")?.trim() || "Untitled";
    const description = xmlTag(block, "media:description")?.trim() ?? "";
    const preview = description.slice(0, 280) || title;
    const postDate = xmlTag(block, "published") ?? new Date().toISOString();
    const views = Number(xmlAttr(block, "media:statistics", "views") ?? 0) || 0;
    const likes = Number(xmlAttr(block, "media:starRating", "count") ?? 0) || 0;
    const coverImage = xmlAttr(block, "media:thumbnail", "url");
    results.push({
      id,
      title,
      preview,
      postDate,
      canonicalUrl: `https://www.youtube.com/watch?v=${id}`,
      views,
      likes,
      comments: 0,
      creatorName: channel.title,
      handle: channel.handle,
      creatorPhotoUrl: channel.photoUrl,
      coverImage,
    });
  }
  results.sort((a, b) => Date.parse(b.postDate) - Date.parse(a.postDate));
  return results;
}

async function fetchYoutubeVideosViaRss(sourceUrl: string): Promise<YoutubeVideoResult[]> {
  const channel = await resolveYoutubeChannelPublic(sourceUrl);
  const rssXml = await fetchText(
    `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channel.channelId)}`,
  );
  return parseYoutubeRssEntries(rssXml, channel);
}

async function youtubeGet<T>(path: string, params: Record<string, string>, key: string): Promise<T> {
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

async function resolveChannelViaApi(sourceUrl: string, key: string): Promise<{
  channelId: string;
  title: string;
  handle: string;
  photoUrl: string | null;
  uploadsPlaylistId: string;
}> {
  const input = parseYoutubeChannelInput(sourceUrl);
  let channelResponse: ChannelListResponse;
  if (input.channelId) {
    channelResponse = await youtubeGet<ChannelListResponse>(
      "channels",
      { part: "snippet,contentDetails", id: input.channelId },
      key,
    );
  } else if (input.handle) {
    channelResponse = await youtubeGet<ChannelListResponse>(
      "channels",
      { part: "snippet,contentDetails", forHandle: input.handle },
      key,
    );
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

async function fetchYoutubeVideosViaApi(
  sourceUrl: string,
  key: string,
): Promise<YoutubeVideoResult[]> {
  const channel = await resolveChannelViaApi(sourceUrl, key);
  const playlist = await youtubeGet<PlaylistItemsResponse>(
    "playlistItems",
    {
      part: "snippet,contentDetails",
      playlistId: channel.uploadsPlaylistId,
      maxResults: String(MAX_VIDEOS),
    },
    key,
  );

  const videoIds =
    playlist.items
      ?.map((item) => item.contentDetails?.videoId)
      .filter((id): id is string => Boolean(id)) ?? [];
  if (videoIds.length === 0) return [];

  const videos = await youtubeGet<VideosListResponse>(
    "videos",
    { part: "snippet,statistics", id: videoIds.join(",") },
    key,
  );

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

export async function fetchYoutubeVideos(sourceUrl: string): Promise<YoutubeVideoResult[]> {
  const key = youtubeApiKey();
  if (!key) {
    return fetchYoutubeVideosViaRss(sourceUrl);
  }
  try {
    return await fetchYoutubeVideosViaApi(sourceUrl, key);
  } catch {
    return fetchYoutubeVideosViaRss(sourceUrl);
  }
}
