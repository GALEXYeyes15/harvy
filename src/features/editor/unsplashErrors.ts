export const UNSPLASH_MISSING_KEY_MESSAGE =
  "Missing Unsplash API key. Add UNSPLASH_ACCESS_KEY to .env.local and restart Harvy.";

/** Tauri invoke rejects with a plain string, not an Error instance. */
export function invokeErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  if (error && typeof error === "object") {
    const maybe = error as { message?: unknown };
    if (typeof maybe.message === "string" && maybe.message.trim()) {
      return maybe.message;
    }
  }
  return "Unsplash search failed";
}

export function formatUnsplashSearchError(message: string): string {
  const normalized = message.trim();
  if (!normalized) return "Unsplash search failed";
  if (
    normalized.includes("UNSPLASH_ACCESS_KEY is not configured") ||
    normalized.includes("UNSPLASH_ACCESS_KEY not configured")
  ) {
    return UNSPLASH_MISSING_KEY_MESSAGE;
  }
  return normalized;
}

export function logUnsplashDebug(message: string): void {
  if (import.meta.env.DEV) {
    console.warn(`[harvy:unsplash] ${message}`);
  }
}
