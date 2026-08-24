/** Dev-server helper: public Medium profile / publication posts. */

export type MediumPostResult = {
  id: string;
  title: string;
  preview: string;
  postDate: string;
  canonicalUrl: string;
  claps: number;
  responses: number;
  creatorName: string;
  handle: string;
  creatorPhotoUrl?: string | null;
  coverImage?: string | null;
};

const USER_AGENT = "Harvy/0.1 (Medium public archive)";
const MAX_POSTS = 100;

export function parseMediumUsername(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("Enter a Medium profile or publication URL.");
  if (trimmed.startsWith("@")) return trimmed.slice(1);
  try {
    const parsed = trimmed.startsWith("http") ? new URL(trimmed) : new URL(`https://${trimmed}`);
    const parts = parsed.pathname.split("/").filter(Boolean);
    const at = parts.find((p) => p.startsWith("@"));
    if (at) return at.slice(1);
    if (parts.length > 0) return parts[0]!;
  } catch {
    return trimmed.replace(/^@/, "");
  }
  throw new Error("Could not parse Medium username from URL.");
}

type MediumJsonItem = {
  title?: string;
  uniqueSlug?: string;
  createdAt?: number;
  firstPublishedAt?: number;
  latestPublishedAt?: number;
  virtuals?: {
    subtitle?: string;
    previewImage?: { imageId?: string };
    previewImageUrl?: string;
    responsesCreatedCount?: number;
  };
  clapCount?: number;
  creator?: {
    name?: string;
    username?: string;
    imageId?: string;
  };
  postId?: string;
  id?: string;
};

type MediumLatestJson = {
  payload?: {
    references?: {
      Post?: Record<string, MediumJsonItem>;
    };
    user?: { name?: string; username?: string; imageId?: string };
    streamItems?: Array<{ postId?: string; itemType?: string }>;
  };
};

function mediumImageUrl(imageId: string | undefined): string | null {
  if (!imageId) return null;
  return `https://cdn-images-1.medium.com/max/800/${imageId}`;
}

function itemToResult(
  post: MediumJsonItem,
  profile: { name: string; handle: string; photoUrl: string | null },
): MediumPostResult | null {
  const postId = post.postId ?? post.id ?? post.uniqueSlug;
  if (!postId) return null;
  const slug = post.uniqueSlug ?? postId;
  const publishedMs =
    post.latestPublishedAt ?? post.firstPublishedAt ?? post.createdAt ?? Date.now();
  const title = (post.title ?? "").trim() || "Untitled";
  const preview = (post.virtuals?.subtitle ?? "").trim() || title;
  const handle = post.creator?.username ?? profile.handle;
  const creatorName = post.creator?.name ?? profile.name;
  const canonicalUrl = `https://medium.com/@${handle}/${slug}`;

  return {
    id: String(postId),
    title,
    preview,
    postDate: new Date(publishedMs).toISOString(),
    canonicalUrl,
    claps: Math.max(0, post.clapCount ?? 0),
    responses: Math.max(0, post.virtuals?.responsesCreatedCount ?? 0),
    creatorName,
    handle: `@${handle}`,
    creatorPhotoUrl: mediumImageUrl(post.creator?.imageId) ?? profile.photoUrl,
    coverImage:
      post.virtuals?.previewImageUrl ??
      mediumImageUrl(post.virtuals?.previewImage?.imageId) ??
      null,
  };
}

export async function fetchMediumPosts(sourceUrl: string): Promise<MediumPostResult[]> {
  const username = parseMediumUsername(sourceUrl);
  const profileUrl = `https://medium.com/@${encodeURIComponent(username)}/latest?format=json`;
  const response = await fetch(profileUrl, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      detail.trim() || `Medium request failed (${response.status}) for @${username}.`,
    );
  }

  const payload = (await response.json()) as MediumLatestJson;
  const postsById = payload.payload?.references?.Post ?? {};
  const user = payload.payload?.user;
  const profile = {
    name: user?.name ?? username,
    handle: user?.username ?? username,
    photoUrl: mediumImageUrl(user?.imageId),
  };

  const streamItems = payload.payload?.streamItems ?? [];
  const results: MediumPostResult[] = [];
  const seen = new Set<string>();

  for (const item of streamItems) {
    if (item.itemType && item.itemType !== "post") continue;
    const postId = item.postId;
    if (!postId) continue;
    const post = postsById[postId];
    if (!post) continue;
    const row = itemToResult(post, profile);
    if (!row || seen.has(row.id)) continue;
    seen.add(row.id);
    results.push(row);
    if (results.length >= MAX_POSTS) break;
  }

  if (results.length === 0) {
    for (const post of Object.values(postsById)) {
      const row = itemToResult(post, profile);
      if (!row || seen.has(row.id)) continue;
      seen.add(row.id);
      results.push(row);
      if (results.length >= MAX_POSTS) break;
    }
  }

  results.sort((a, b) => Date.parse(b.postDate) - Date.parse(a.postDate));
  return results;
}
