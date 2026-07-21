/** Dev-server helper: public Substack newsletter archive + Notes (no auth). */

export type SubstackPostResult = {
  id: string;
  title: string;
  preview: string;
  postDate: string;
  canonicalUrl: string;
  likes: number;
  comments: number;
  restacks: number;
  coverImage: string | null;
  creatorName: string;
  handle: string;
  subdomain: string;
  creatorPhotoUrl?: string | null;
  kind: "newsletter" | "note";
  bodyJson?: unknown;
};

type PublicProfile = {
  id: number;
  name: string;
  handle: string;
  photo_url?: string | null;
  publicationUsers?: Array<{
    public?: boolean;
    is_primary?: boolean;
    publication?: { subdomain?: string };
  }>;
};

type ArchivePost = {
  id: number;
  title?: string | null;
  subtitle?: string | null;
  description?: string | null;
  truncated_body_text?: string | null;
  post_date?: string | null;
  canonical_url?: string | null;
  cover_image?: string | null;
  reactions?: Record<string, number> | null;
  restacks?: number | null;
  comment_count?: number | null;
};

type NotesFeedItem = {
  entity_key?: string | null;
  context?: { type?: string | null } | null;
  comment?: {
    id: number;
    body?: string | null;
    body_json?: unknown;
    date?: string | null;
    reaction_count?: number | null;
    reactions?: Record<string, number> | null;
    restacks?: number | null;
    children_count?: number | null;
  } | null;
};

type NotesFeedResponse = {
  items?: NotesFeedItem[];
  nextCursor?: string | null;
};

const ARCHIVE_PAGE_SIZE = 50;
const ARCHIVE_MAX_POSTS = 200;
const NOTES_PAGE_SIZE = 20;
const NOTES_MAX_ITEMS = 200;
const USER_AGENT = "Harvy/0.1 (Substack public archive)";

export function parseSubstackHandle(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("Enter a Substack profile or publication URL.");
  }

  const withoutAt = trimmed.replace(/^@/, "");
  if (!withoutAt.includes("/") && !withoutAt.includes(".")) {
    if (!withoutAt) throw new Error("Enter a Substack profile or publication URL.");
    return withoutAt.toLowerCase();
  }

  const normalized =
    trimmed.startsWith("http://") || trimmed.startsWith("https://")
      ? trimmed
      : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    throw new Error("Could not parse that Substack link. Try https://substack.com/@yourhandle.");
  }

  const host = url.hostname.toLowerCase();
  if (host === "substack.com" || host === "www.substack.com") {
    const first = url.pathname.split("/").filter(Boolean)[0] ?? "";
    const handle = first.replace(/^@/, "").toLowerCase();
    if (!handle) {
      throw new Error("Use a profile link like https://substack.com/@yourhandle.");
    }
    return handle;
  }

  if (host.endsWith(".substack.com")) {
    const subdomain = host.slice(0, -".substack.com".length);
    if (subdomain && subdomain !== "www") return subdomain.toLowerCase();
  }

  throw new Error("Only public Substack profile or publication links are supported.");
}

function likesFromReactions(reactions: Record<string, number> | null | undefined): number {
  if (!reactions) return 0;
  for (const key of ["❤", "❤️", "like", "♥"]) {
    const value = reactions[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return Math.max(0, Math.floor(value));
    }
  }
  return 0;
}

function pickSubdomain(profile: PublicProfile): string | null {
  const users = profile.publicationUsers ?? [];
  const primary =
    users.find((u) => u.is_primary && u.public) ??
    users.find((u) => u.public) ??
    users[0];
  const subdomain = primary?.publication?.subdomain?.trim();
  return subdomain || null;
}

function noteTitleFromBody(body: string): string {
  const firstLine = body.split(/\r?\n/).map((l) => l.trim()).find(Boolean) || "Note";
  return firstLine.length > 80 ? `${firstLine.slice(0, 80)}…` : firstLine;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Substack request failed (${response.status}).`);
  }
  return (await response.json()) as T;
}

async function fetchNewsletterPosts(
  subdomain: string,
  creatorName: string,
  creatorHandle: string,
  creatorPhotoUrl: string | null,
): Promise<SubstackPostResult[]> {
  const posts: SubstackPostResult[] = [];
  let offset = 0;

  while (posts.length < ARCHIVE_MAX_POSTS) {
    const page = await fetchJson<ArchivePost[]>(
      `https://${subdomain}.substack.com/api/v1/archive?sort=new&search=&offset=${offset}&limit=${ARCHIVE_PAGE_SIZE}`,
    );
    if (page.length === 0) break;

    for (const post of page) {
      const postDate = post.post_date?.trim();
      if (!postDate) continue;
      const title = post.title?.trim() || "Untitled";
      const preview =
        post.subtitle?.trim() ||
        post.description?.trim() ||
        post.truncated_body_text?.trim() ||
        "";
      posts.push({
        id: `newsletter-${post.id}`,
        title,
        preview,
        postDate,
        canonicalUrl: post.canonical_url?.trim() || `https://${subdomain}.substack.com`,
        likes: likesFromReactions(post.reactions),
        comments:
          typeof post.comment_count === "number" ? Math.max(0, Math.floor(post.comment_count)) : 0,
        restacks: typeof post.restacks === "number" ? post.restacks : 0,
        coverImage: post.cover_image?.trim() || null,
        creatorName,
        handle: `@${creatorHandle}`,
        subdomain,
        creatorPhotoUrl,
        kind: "newsletter",
        bodyJson: undefined,
      });
      if (posts.length >= ARCHIVE_MAX_POSTS) break;
    }

    if (page.length < ARCHIVE_PAGE_SIZE) break;
    offset += page.length;
  }

  return posts;
}

async function fetchNotePosts(
  userId: number,
  creatorName: string,
  creatorHandle: string,
  subdomain: string,
  creatorPhotoUrl: string | null,
): Promise<SubstackPostResult[]> {
  const notes: SubstackPostResult[] = [];
  let cursor: string | null = null;

  while (notes.length < NOTES_MAX_ITEMS) {
    const url = new URL(
      `https://substack.com/api/v1/reader/feed/profile/${userId}`,
    );
    url.searchParams.append("types[]", "note");
    url.searchParams.set("limit", String(NOTES_PAGE_SIZE));
    if (cursor) url.searchParams.set("cursor", cursor);

    const page = await fetchJson<NotesFeedResponse>(url.toString());
    const items = page.items ?? [];
    if (items.length === 0) break;

    for (const item of items) {
      if (item.context?.type !== "note" || !item.comment) continue;
      const body = item.comment.body?.trim() ?? "";
      const postDate = item.comment.date?.trim() ?? "";
      if (!body || !postDate) continue;
      const entity = item.entity_key?.trim() || `c-${item.comment.id}`;
      const likes =
        typeof item.comment.reaction_count === "number"
          ? item.comment.reaction_count
          : likesFromReactions(item.comment.reactions);

      notes.push({
        id: `note-${item.comment.id}`,
        title: noteTitleFromBody(body),
        preview: body,
        postDate,
        canonicalUrl: `https://substack.com/@${creatorHandle}/note/${entity}`,
        likes: Math.max(0, Math.floor(likes)),
        comments:
          typeof item.comment.children_count === "number"
            ? Math.max(0, Math.floor(item.comment.children_count))
            : 0,
        restacks:
          typeof item.comment.restacks === "number" ? item.comment.restacks : 0,
        coverImage: null,
        creatorName,
        handle: `@${creatorHandle}`,
        subdomain,
        creatorPhotoUrl,
        kind: "note",
        bodyJson: item.comment.body_json ?? undefined,
      });
      if (notes.length >= NOTES_MAX_ITEMS) break;
    }

    const next = page.nextCursor?.trim() || null;
    if (!next) break;
    cursor = next;
  }

  return notes;
}

export async function fetchSubstackPosts(accountUrl: string): Promise<SubstackPostResult[]> {
  const handle = parseSubstackHandle(accountUrl);
  const profile = await fetchJson<PublicProfile>(
    `https://substack.com/api/v1/user/${encodeURIComponent(handle)}/public_profile`,
  );
  const creatorName = profile.name.trim() || handle;
  const creatorHandle = profile.handle.toLowerCase();
  const subdomain = pickSubdomain(profile) ?? creatorHandle;
  const creatorPhotoUrl = profile.photo_url?.trim() || null;

  const posts: SubstackPostResult[] = [];
  const publicationSubdomain = pickSubdomain(profile);
  if (publicationSubdomain) {
    posts.push(
      ...(await fetchNewsletterPosts(
        publicationSubdomain,
        creatorName,
        creatorHandle,
        creatorPhotoUrl,
      )),
    );
  }
  posts.push(
    ...(await fetchNotePosts(
      profile.id,
      creatorName,
      creatorHandle,
      subdomain,
      creatorPhotoUrl,
    )),
  );

  if (posts.length === 0) {
    throw new Error(`No public posts or Notes found for @${creatorHandle}.`);
  }

  posts.sort((a, b) => b.postDate.localeCompare(a.postDate));
  return posts;
}

export type SubstackCommentResult = {
  id: string;
  authorName: string;
  handle: string;
  body: string;
  date: string;
  likes: number;
  photoUrl?: string | null;
  bodyJson?: unknown;
  replies: SubstackCommentResult[];
};

type ApiCommentNode = {
  id: number;
  body?: string | null;
  body_json?: unknown;
  date?: string | null;
  name?: string | null;
  handle?: string | null;
  photo_url?: string | null;
  reaction_count?: number | null;
  reactions?: Record<string, number> | null;
  deleted?: boolean | null;
  children?: ApiCommentNode[] | null;
};

function mapApiComment(node: ApiCommentNode): SubstackCommentResult | null {
  if (node.deleted) return null;
  const body = node.body?.trim() ?? "";
  if (!body) return null;
  const likes =
    typeof node.reaction_count === "number"
      ? Math.max(0, Math.floor(node.reaction_count))
      : likesFromReactions(node.reactions);
  const handleRaw = node.handle?.trim() ?? "";
  const handle = handleRaw
    ? handleRaw.startsWith("@")
      ? handleRaw
      : `@${handleRaw}`
    : "";
  return {
    id: String(node.id),
    authorName: node.name?.trim() || "Anonymous",
    handle,
    body,
    date: node.date?.trim() ?? "",
    likes,
    photoUrl: node.photo_url?.trim() || null,
    bodyJson: node.body_json ?? undefined,
    replies: (node.children ?? [])
      .map(mapApiComment)
      .filter((c): c is SubstackCommentResult => Boolean(c)),
  };
}

export async function fetchSubstackComments(opts: {
  kind: string;
  sourceId: number;
  subdomain: string;
}): Promise<SubstackCommentResult[]> {
  const kind = opts.kind.trim().toLowerCase();
  const sourceId = opts.sourceId;

  if (kind === "note") {
    const payload = await fetchJson<{
      commentBranches?: Array<{
        comment?: ApiCommentNode | null;
        descendantComments?: Array<{ comment?: ApiCommentNode | null } | null> | null;
      }>;
    }>(`https://substack.com/api/v1/reader/comment/${sourceId}/replies`);

    const out: SubstackCommentResult[] = [];
    for (const branch of payload.commentBranches ?? []) {
      const top = branch.comment ? mapApiComment(branch.comment) : null;
      if (!top) continue;
      const nested = (branch.descendantComments ?? [])
        .map((d) => (d?.comment ? mapApiComment(d.comment) : null))
        .filter((c): c is SubstackCommentResult => Boolean(c));
      top.replies.push(...nested);
      out.push(top);
    }
    return out;
  }

  if (kind === "newsletter" || kind === "post") {
    const subdomain = opts.subdomain.trim();
    if (!subdomain) {
      throw new Error("Missing publication subdomain for post comments.");
    }
    const payload = await fetchJson<{ comments?: ApiCommentNode[] }>(
      `https://${subdomain}.substack.com/api/v1/post/${sourceId}/comments`,
    );
    return (payload.comments ?? [])
      .map(mapApiComment)
      .filter((c): c is SubstackCommentResult => Boolean(c));
  }

  throw new Error(`Unknown content kind: ${opts.kind}`);
}
