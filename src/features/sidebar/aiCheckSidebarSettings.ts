const STORAGE_SHOW_AI_CHECK = "harvy:show-ai-check-sidebar";

export type AiCheckSidebarSettings = {
  /** When on, AI check controls appear in the Edit sidebar (Write). */
  showAiCheck: boolean;
};

const defaultSettings: AiCheckSidebarSettings = {
  showAiCheck: true,
};

export function readAiCheckSidebarSettings(): AiCheckSidebarSettings {
  if (typeof window === "undefined") return { ...defaultSettings };
  const raw = localStorage.getItem(STORAGE_SHOW_AI_CHECK);
  if (raw === null) return { ...defaultSettings };
  return {
    showAiCheck: raw === "true",
  };
}

export function writeAiCheckSidebarSettings(
  partial: Partial<AiCheckSidebarSettings>,
): AiCheckSidebarSettings {
  const next = { ...readAiCheckSidebarSettings(), ...partial };
  if (typeof window !== "undefined" && partial.showAiCheck !== undefined) {
    localStorage.setItem(STORAGE_SHOW_AI_CHECK, next.showAiCheck ? "true" : "false");
  }
  return next;
}
