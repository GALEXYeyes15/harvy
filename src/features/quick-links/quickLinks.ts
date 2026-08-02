import { parseSafeExternalUrl } from "../editor/openExternalUrl";

export type QuickLink = {
  id: string;
  title: string;
  url: string;
};

/** Ensure http(s)/mailto; bare domains get https://. */
export function normalizeQuickLinkUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  return parseSafeExternalUrl(withProtocol);
}

export function createQuickLink(partial?: Partial<Pick<QuickLink, "title" | "url">>): QuickLink {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `quick-link-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  return {
    id,
    title: partial?.title?.trim() ?? "",
    url: partial?.url?.trim() ?? "",
  };
}

export function normalizeQuickLink(link: QuickLink): QuickLink {
  const url = normalizeQuickLinkUrl(link.url) ?? link.url.trim();
  const title = link.title.trim();
  return {
    id: link.id,
    title: title || displayHostFromUrl(url) || "Link",
    url,
  };
}

export function displayHostFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "mailto:") {
      return parsed.pathname || url;
    }
    return parsed.hostname.replace(/^www\./, "") || url;
  } catch {
    return url;
  }
}

export function parsePersistedQuickLinks(value: unknown): QuickLink[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row) => {
    const link = parseQuickLinkRecord(row);
    return link ? [normalizeQuickLink(link)] : [];
  });
}

function parseQuickLinkRecord(value: unknown): QuickLink | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string") return null;
  if (typeof record.url !== "string") return null;
  const title = typeof record.title === "string" ? record.title : "";
  const url = normalizeQuickLinkUrl(record.url);
  if (!url) return null;
  return { id: record.id, title, url };
}
