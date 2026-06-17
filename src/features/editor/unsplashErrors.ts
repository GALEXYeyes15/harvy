export const UNSPLASH_MISSING_KEY_MESSAGE =
  "Missing Unsplash API key. Add UNSPLASH_ACCESS_KEY to .env.local and restart Harvy.";

const MISSING_KEY_RE =
  /UNSPLASH_ACCESS_KEY|not configured|Missing Unsplash API key/i;

export function extractErrorMessage(error: unknown): string {
  if (typeof error === "string") return error.trim();
  if (error instanceof Error) return error.message.trim();
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    if (typeof record.message === "string") return record.message.trim();
    if (typeof record.error === "string") return record.error.trim();
  }
  const fallback = String(error).trim();
  return fallback === "[object Object]" ? "" : fallback;
}

export function formatUnsplashSearchError(error: unknown): string {
  const raw = extractErrorMessage(error);
  if (!raw) return "Unsplash search failed";
  if (MISSING_KEY_RE.test(raw)) return UNSPLASH_MISSING_KEY_MESSAGE;
  return raw;
}

export function logUnsplashSearchFailure(message: string): void {
  if (!import.meta.env.DEV) return;
  console.warn("[harvy] Unsplash search failed:", message);
}
