export type OutlierPlatform = "substack" | "medium" | "youtube";
export type OutlierSourceKind = "account" | "feed";

export type OutlierSource = {
  id: string;
  platform: OutlierPlatform;
  kind: OutlierSourceKind;
  url: string;
  label: string;
};

export const OUTLIER_PLATFORM_LABELS: Record<OutlierPlatform, string> = {
  substack: "Substack",
  medium: "Medium",
  youtube: "YouTube",
};

export const OUTLIER_PLATFORM_PLACEHOLDERS: Record<OutlierPlatform, string> = {
  substack: "https://substack.com/@…",
  medium: "https://medium.com/@…",
  youtube: "https://youtube.com/@…",
};

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `src-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createOutlierSource(input: {
  platform: OutlierPlatform;
  kind: OutlierSourceKind;
  url: string;
  label?: string;
}): OutlierSource {
  const url = input.url.trim();
  return {
    id: randomId(),
    platform: input.platform,
    kind: input.kind,
    url,
    label: input.label?.trim() || defaultLabelForOutlierSource(input.platform, input.kind, url),
  };
}

export function defaultLabelForOutlierSource(
  platform: OutlierPlatform,
  kind: OutlierSourceKind,
  url: string,
): string {
  const handle = extractDisplayHandle(platform, url);
  const kindLabel = kind === "feed" ? "Feed" : "Account";
  return handle ? `${handle} (${OUTLIER_PLATFORM_LABELS[platform]} ${kindLabel})` : OUTLIER_PLATFORM_LABELS[platform];
}

export function extractDisplayHandle(platform: OutlierPlatform, url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  try {
    const parsed = trimmed.startsWith("http") ? new URL(trimmed) : new URL(`https://${trimmed}`);
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (platform === "substack") {
      const at = parts.find((p) => p.startsWith("@"));
      if (at) return at;
      return parts[0] ?? parsed.hostname;
    }
    if (platform === "medium") {
      const at = parts.find((p) => p.startsWith("@"));
      if (at) return at;
      return parts[0] ?? parsed.hostname;
    }
    if (platform === "youtube") {
      const at = parts.find((p) => p.startsWith("@"));
      if (at) return at;
      if (parts[0] === "channel" && parts[1]) return parts[1].slice(0, 12);
      return parts[0] ?? parsed.hostname;
    }
  } catch {
    if (trimmed.startsWith("@")) return trimmed;
  }
  return trimmed.replace(/^https?:\/\//, "").slice(0, 32);
}

export function normalizeOutlierSourceUrl(platform: OutlierPlatform, url: string): string {
  const trimmed = url.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  if (platform === "substack") {
    return trimmed.replace(/\/+$/, "").toLowerCase();
  }
  if (platform === "medium") {
    return trimmed.replace(/\/+$/, "").toLowerCase();
  }
  return trimmed.replace(/\/+$/, "").toLowerCase();
}

export function outlierSourceCacheKey(source: Pick<OutlierSource, "id" | "platform" | "url">): string {
  return `${source.platform}:${normalizeOutlierSourceUrl(source.platform, source.url)}:${source.id}`;
}

export function validateOutlierSourceUrl(platform: OutlierPlatform, url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return "Enter a URL.";
  try {
    const parsed = trimmed.startsWith("http") ? new URL(trimmed) : new URL(`https://${trimmed}`);
    const host = parsed.hostname.replace(/^www\./, "");
    if (platform === "substack" && !host.includes("substack.com")) {
      return "Use a substack.com profile or publication URL.";
    }
    if (platform === "medium" && !host.includes("medium.com")) {
      return "Use a medium.com profile or publication URL.";
    }
    if (
      platform === "youtube" &&
      !["youtube.com", "youtu.be", "m.youtube.com"].some((h) => host === h || host.endsWith(`.${h}`))
    ) {
      return "Use a youtube.com channel URL.";
    }
    return null;
  } catch {
    return "Enter a valid URL.";
  }
}
