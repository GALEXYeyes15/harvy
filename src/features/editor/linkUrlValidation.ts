export type LinkUrlValidationResult =
  | { ok: true; href: string }
  | { ok: false; reason: "empty" | "invalid" };

/** Prepend https:// when the user omits a scheme (e.g. example.com, www.example.com). */
export function normalizeLinkUrl(input: string): string {
  const trimmed = input.trim();
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

function isAcceptableHostname(hostname: string): boolean {
  if (!hostname) return false;
  if (hostname === "localhost") return true;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return true;
  return hostname.includes(".");
}

/** Parse and validate a user-entered link URL. */
export function parseLinkUrl(input: string): LinkUrlValidationResult {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, reason: "empty" };

  try {
    const normalized = normalizeLinkUrl(trimmed);
    const url = new URL(normalized);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return { ok: false, reason: "invalid" };
    }
    if (!isAcceptableHostname(url.hostname)) {
      return { ok: false, reason: "invalid" };
    }

    return { ok: true, href: url.href };
  } catch {
    return { ok: false, reason: "invalid" };
  }
}
