const STORAGE_SHOW_AI_CHECK = "harvy:show-ai-check-sidebar";
const STORAGE_SHOW_PODCAST_NOTES = "harvy:show-podcast-notes";
const STORAGE_SHOW_TITLE_GENERATION = "harvy:show-title-generation";
const STORAGE_SHOW_RELATED_ESSAYS = "harvy:show-related-essays";

export type AiCheckSidebarSettings = {
  /** When on, AI check controls appear in the Edit sidebar (Write). */
  showAiCheck: boolean;
  /** When on, Export Podcast Notes is available. */
  showPodcastNotes: boolean;
  /** When on, two-finger click Title or Subtitle to suggest titles. */
  showTitleGeneration: boolean;
  /** When on, Find Related Essays appears in Notes. */
  showRelatedEssays: boolean;
};

const defaultSettings: AiCheckSidebarSettings = {
  showAiCheck: true,
  showPodcastNotes: true,
  showTitleGeneration: true,
  showRelatedEssays: true,
};

function readFlag(key: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  const raw = localStorage.getItem(key);
  if (raw === null) return fallback;
  return raw === "true";
}

export function readAiCheckSidebarSettings(): AiCheckSidebarSettings {
  return {
    showAiCheck: readFlag(STORAGE_SHOW_AI_CHECK, defaultSettings.showAiCheck),
    showPodcastNotes: readFlag(STORAGE_SHOW_PODCAST_NOTES, defaultSettings.showPodcastNotes),
    showTitleGeneration: readFlag(
      STORAGE_SHOW_TITLE_GENERATION,
      defaultSettings.showTitleGeneration,
    ),
    showRelatedEssays: readFlag(
      STORAGE_SHOW_RELATED_ESSAYS,
      defaultSettings.showRelatedEssays,
    ),
  };
}

export function writeAiCheckSidebarSettings(
  partial: Partial<AiCheckSidebarSettings>,
): AiCheckSidebarSettings {
  const next = { ...readAiCheckSidebarSettings(), ...partial };
  if (typeof window === "undefined") return next;
  if (partial.showAiCheck !== undefined) {
    localStorage.setItem(STORAGE_SHOW_AI_CHECK, next.showAiCheck ? "true" : "false");
  }
  if (partial.showPodcastNotes !== undefined) {
    localStorage.setItem(STORAGE_SHOW_PODCAST_NOTES, next.showPodcastNotes ? "true" : "false");
  }
  if (partial.showTitleGeneration !== undefined) {
    localStorage.setItem(STORAGE_SHOW_TITLE_GENERATION, next.showTitleGeneration ? "true" : "false");
  }
  if (partial.showRelatedEssays !== undefined) {
    localStorage.setItem(STORAGE_SHOW_RELATED_ESSAYS, next.showRelatedEssays ? "true" : "false");
  }
  return next;
}
