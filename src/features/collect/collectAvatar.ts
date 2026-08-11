const STORAGE_KEY = "harvy:collect-avatar-text";

export function readCollectAvatarText(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function writeCollectAvatarText(text: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, text);
  } catch {
    // Quota / private mode — ignore.
  }
}
