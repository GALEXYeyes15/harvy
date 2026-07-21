export type OutlierPost = {
  id: string;
  creatorName: string;
  creatorPhotoUrl?: string | null;
  handle: string;
  platform: string;
  postedAgo: string;
  /** ISO timestamp used for date filtering. */
  postDateIso: string;
  preview: string;
  likes: string;
  likesCount: number;
  comments: string;
  commentsCount: number;
  restacks: string;
  restacksCount: number;
  views: string;
  outlierMultiple: string;
  /** Numeric multiple for filtering (`likes / average likes`). */
  outlierMultipleValue: number;
  hasThumbnail?: boolean;
  thumbnailUrl?: string | null;
  thumbnailTone?: "slate" | "warm" | "cool";
  thumbnailHeight?: "short" | "tall";
  captionBelowThumbnail?: string;
  canonicalUrl?: string;
  /** Publication subdomain (needed to load newsletter comments). */
  subdomain?: string;
  /** Substack Note rich body (ProseMirror JSON). */
  noteBodyJson?: unknown;
};

export type OutlierScoreFilter = "any" | "3x" | "5x" | "10x" | "20x";
export type PostedWithinFilter = "week" | "month" | "3months" | "year";
export type ContentTypeFilter = {
  showNotes: boolean;
  showPosts: boolean;
};

export const DEFAULT_CONTENT_TYPE_FILTER: ContentTypeFilter = {
  showNotes: true,
  showPosts: false,
};

export function isOutlierNote(post: OutlierPost): boolean {
  return post.platform === "Note";
}

/** Keep at least one content type enabled. */
export function toggleContentType(
  current: ContentTypeFilter,
  key: keyof ContentTypeFilter,
): ContentTypeFilter {
  const next = { ...current, [key]: !current[key] };
  if (!next.showNotes && !next.showPosts) {
    return current;
  }
  return next;
}

export function formatCompactCount(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "0";
  if (value < 1000) return String(Math.round(value));
  if (value < 10_000) return `${(value / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  if (value < 1_000_000) return `${Math.round(value / 1000)}K`;
  return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
}

export function formatOutlierTimestamp(isoDate: string): string {
  const then = Date.parse(isoDate);
  if (!Number.isFinite(then)) return "";
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(then));
  } catch {
    return "";
  }
}

export function formatPostedAgo(isoDate: string, nowMs = Date.now()): string {
  const then = Date.parse(isoDate);
  if (!Number.isFinite(then)) return "";
  const deltaMs = Math.max(0, nowMs - then);
  const minutes = Math.floor(deltaMs / 60_000);
  if (minutes < 60) return `${Math.max(1, minutes)}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 9) return `${weeks}w`;
  const months = Math.floor(days / 30);
  if (months < 18) return `${Math.max(1, months)}mo`;
  const years = Math.floor(days / 365);
  return `${Math.max(1, years)}y`;
}

function pluralUnit(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Relative time for “last fetch” labels, e.g. “12 minutes ago”, “1 day ago”. */
export function formatFetchedAgo(fetchedAtMs: number, nowMs = Date.now()): string {
  if (!Number.isFinite(fetchedAtMs)) return "";
  const deltaMs = Math.max(0, nowMs - fetchedAtMs);
  const seconds = Math.floor(deltaMs / 1000);
  if (seconds < 45) return "just now";
  const minutes = Math.floor(deltaMs / 60_000);
  if (minutes < 60) return `${pluralUnit(Math.max(1, minutes), "minute")} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${pluralUnit(hours, "hour")} ago`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `${pluralUnit(days, "day")} ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 9) return `${pluralUnit(weeks, "week")} ago`;
  const months = Math.floor(days / 30);
  if (months < 18) return `${pluralUnit(Math.max(1, months), "month")} ago`;
  const years = Math.floor(days / 365);
  return `${pluralUnit(Math.max(1, years), "year")} ago`;
}

export function formatOutlierMultiple(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "—";
  if (value < 10) return `${value.toFixed(1).replace(/\.0$/, "")}x`;
  return `${Math.round(value)}x`;
}

export function scoreThreshold(filter: OutlierScoreFilter): number | null {
  switch (filter) {
    case "3x":
      return 3;
    case "5x":
      return 5;
    case "10x":
      return 10;
    case "20x":
      return 20;
    default:
      return null;
  }
}

export function postedWithinCutoffMs(filter: PostedWithinFilter, nowMs = Date.now()): number {
  const day = 24 * 60 * 60 * 1000;
  switch (filter) {
    case "week":
      return nowMs - 7 * day;
    case "month":
      return nowMs - 30 * day;
    case "3months":
      return nowMs - 90 * day;
    case "year":
      return nowMs - 365 * day;
  }
}

export function filterOutlierPosts(
  posts: OutlierPost[],
  opts: {
    score: OutlierScoreFilter;
    postedWithin: PostedWithinFilter;
    contentType: ContentTypeFilter;
    nowMs?: number;
  },
): OutlierPost[] {
  const nowMs = opts.nowMs ?? Date.now();
  const cutoff = postedWithinCutoffMs(opts.postedWithin, nowMs);
  const minScore = scoreThreshold(opts.score);

  return posts.filter((post) => {
    const postedAt = Date.parse(post.postDateIso);
    if (!Number.isFinite(postedAt) || postedAt < cutoff) return false;
    if (minScore != null && post.outlierMultipleValue < minScore) return false;
    const note = isOutlierNote(post);
    if (note && !opts.contentType.showNotes) return false;
    if (!note && !opts.contentType.showPosts) return false;
    return true;
  });
}
