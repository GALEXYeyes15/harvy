/**
 * Sync snapshot of AI check UI prefs for DOM popovers (click handlers outside React).
 * Updated whenever Settings / AppShell loads or changes AI check config.
 */
export const aiCheckPopoverPrefsRef = {
  showReplaceSuggestions: true,
};

export function syncAiCheckPopoverPrefs(config: {
  showReplaceSuggestions?: boolean;
} | null): void {
  aiCheckPopoverPrefsRef.showReplaceSuggestions = config?.showReplaceSuggestions !== false;
}
