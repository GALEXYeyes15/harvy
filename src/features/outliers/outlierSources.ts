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

export function formatOutlierSourceListLabel(
  source: Pick<OutlierSource, "platform" | "url">,
): { handle: string; suffix: string } {
  const handle = extractDisplayHandle(source.platform, source.url);
  return {
    handle,
    suffix: ` · ${OUTLIER_PLATFORM_LABELS[source.platform]}`,
  };
}

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `src-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export const OUTLIER_SOURCE_URL_PLACEHOLDER = "Paste account URL";

export function createOutlierSource(input: {
  platform: OutlierPlatform;
  kind?: OutlierSourceKind;
  url: string;
  label?: string;
}): OutlierSource {
  const url = input.url.trim();
  const kind = input.kind ?? "account";
  return {
    id: randomId(),
    platform: input.platform,
    kind,
    url,
    label: input.label?.trim() || defaultLabelForOutlierSource(input.platform, url),
  };
}

export function defaultLabelForOutlierSource(
  platform: OutlierPlatform,
  url: string,
): string {
  const { handle, suffix } = formatOutlierSourceListLabel({ platform, url });
  return `${handle}${suffix}`;
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

export function detectOutlierPlatformFromUrl(url: string): OutlierPlatform | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    const parsed = trimmed.startsWith("http") ? new URL(trimmed) : new URL(`https://${trimmed}`);
    const host = parsed.hostname.replace(/^www\./, "");
    if (host.includes("substack.com")) return "substack";
    if (host.includes("medium.com")) return "medium";
    if (["youtube.com", "youtu.be", "m.youtube.com"].some((h) => host === h || host.endsWith(`.${h}`))) {
      return "youtube";
    }
  } catch {
    return null;
  }
  return null;
}

export function validateOutlierSourceUrlAuto(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return "Enter a URL.";
  const platform = detectOutlierPlatformFromUrl(trimmed);
  if (!platform) return "Use a Substack, Medium, or YouTube URL.";
  return validateOutlierSourceUrl(platform, trimmed);
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
