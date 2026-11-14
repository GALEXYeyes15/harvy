/**
 * Harvy Reader's shared highlights index (`~/Documents/Harvy Reader/highlights.json`).
 * Writer only reads it. Every field is treated defensively: entries without text are
 * skipped and unknown fields are ignored.
 */

export type ReaderHighlightColor = "yellow" | "green" | "blue" | "rose";

export type ReaderHighlightSourceKind = "epub" | "pdf" | "md" | "docx" | "article";

export type ReaderHighlightSource = {
  kind: ReaderHighlightSourceKind | null;
  title: string;
  author: string;
  url: string;
  site: string;
  published: string;
  year: number | null;
};

export type ReaderHighlight = {
  id: string;
  text: string;
  note: string;
  chapter: string;
  /** Epoch ms, or null when missing / unparseable. */
  created: number | null;
  updated: number | null;
  color: ReaderHighlightColor;
  tags: string[];
  favorite: boolean;
  source: ReaderHighlightSource;
};

export type ReaderHighlightsIndex = {
  updatedAt: number | null;
  highlights: ReaderHighlight[];
};

const COLORS = new Set<ReaderHighlightColor>(["yellow", "green", "blue", "rose"]);
const SOURCE_KINDS = new Set<ReaderHighlightSourceKind>(["epub", "pdf", "md", "docx", "article"]);

export const EMPTY_READER_HIGHLIGHTS: ReaderHighlightsIndex = { updatedAt: null, highlights: [] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function time(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const ms = typeof value === "number" ? value : Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function year(value: unknown): number | null {
  const n = typeof value === "string" ? Number.parseInt(value, 10) : value;
  return typeof n === "number" && Number.isInteger(n) && n > 0 ? n : null;
}

function normalizeSource(value: unknown): ReaderHighlightSource {
  const raw = isRecord(value) ? value : {};
  const kind = str(raw.kind).toLowerCase() as ReaderHighlightSourceKind;
  return {
    kind: SOURCE_KINDS.has(kind) ? kind : null,
    title: str(raw.title),
    author: str(raw.author),
    url: str(raw.url),
    site: str(raw.site),
    published: str(raw.published),
    year: year(raw.year),
  };
}

function hashText(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

export function normalizeReaderHighlight(value: unknown): ReaderHighlight | null {
  if (!isRecord(value)) return null;
  // Reader soft-deletes highlights; never show one that's in its trash.
  if (value.deletedAt != null && value.deletedAt !== "") return null;
  // Keep the quote's own line breaks, but trim the edges.
  const text = typeof value.text === "string" ? value.text.trim() : "";
  if (!text) return null;

  const color = str(value.color).toLowerCase() as ReaderHighlightColor;
  const tags = Array.isArray(value.tags)
    ? [...new Set(value.tags.map(str).filter(Boolean))]
    : [];

  return {
    id: str(value.id) || `h_${hashText(text)}`,
    text,
    note: typeof value.note === "string" ? value.note.trim() : "",
    chapter: str(value.chapter),
    created: time(value.created),
    updated: time(value.updated),
    color: COLORS.has(color) ? color : "yellow",
    tags,
    favorite: value.favorite === true,
    source: normalizeSource(value.source),
  };
}

/** Parse the raw file text. Throws only on invalid JSON; a wrong shape yields no highlights. */
export function parseReaderHighlights(raw: string | null | undefined): ReaderHighlightsIndex {
  if (!raw || !raw.trim()) return EMPTY_READER_HIGHLIGHTS;
  const parsed: unknown = JSON.parse(raw);
  if (!isRecord(parsed)) return EMPTY_READER_HIGHLIGHTS;

  const list = Array.isArray(parsed.highlights) ? parsed.highlights : [];
  const seen = new Set<string>();
  const highlights: ReaderHighlight[] = [];
  for (const entry of list) {
    const highlight = normalizeReaderHighlight(entry);
    if (!highlight || seen.has(highlight.id)) continue;
    seen.add(highlight.id);
    highlights.push(highlight);
  }

  // Newest first; undated entries keep file order at the end.
  highlights.sort((a, b) => (b.created ?? -Infinity) - (a.created ?? -Infinity));

  return { updatedAt: time(parsed.updatedAt), highlights };
}

/** "Author, Title" or whichever half exists, falling back to the site. */
export function formatHighlightSourceLine(source: ReaderHighlightSource): string {
  const title = source.title || source.site;
  return [source.author, title].filter(Boolean).join(", ");
}

/** Text appended to the essay's notes. */
export function formatHighlightForNotes(highlight: ReaderHighlight): string {
  const lines = [`“${highlight.text}”`];
  const attribution = [formatHighlightSourceLine(highlight.source), highlight.chapter]
    .filter(Boolean)
    .join(" · ");
  if (attribution) lines.push(`— ${attribution}`);
  if (highlight.source.url) lines.push(highlight.source.url);
  if (highlight.note) lines.push(`Note: ${highlight.note}`);
  return lines.join("\n");
}

export function highlightMatchesQuery(highlight: ReaderHighlight, query: string): boolean {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const haystack = [
    highlight.text,
    highlight.note,
    highlight.chapter,
    highlight.source.title,
    highlight.source.author,
    highlight.source.site,
    ...highlight.tags.map((tag) => `#${tag}`),
  ]
    .join("\n")
    .toLowerCase();
  return terms.every((term) => haystack.includes(term));
}
