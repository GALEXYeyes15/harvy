import { isTauriRuntime } from "../save/saveRuntime";

const SAFE_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

/** Parse and validate an href before opening externally. */
export function parseSafeExternalUrl(href: string): string | null {
  const trimmed = href.trim();
  if (!trimmed || trimmed === "#") return null;

  try {
    const url = new URL(trimmed);
    if (!SAFE_PROTOCOLS.has(url.protocol)) return null;
    return url.href;
  } catch {
    return null;
  }
}

async function openSafeExternalUrlAsync(url: string): Promise<void> {
  if (isTauriRuntime()) {
    // Always use the system opener. `window.open` creates another Harvy webview.
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

/** Open a validated external URL (http, https, mailto only). */
export function openSafeExternalUrl(
  href: string,
  event?: { preventDefault: () => void; stopPropagation: () => void },
): void {
  event?.preventDefault();
  event?.stopPropagation();

  const safe = parseSafeExternalUrl(href);
  if (!safe) return;

  void openSafeExternalUrlAsync(safe);
}
