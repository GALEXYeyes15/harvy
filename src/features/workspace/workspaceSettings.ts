const STORAGE_ENABLE_COLLECT = "harvy:enable-collect";

export type WorkspaceSettings = {
  enableCollect: boolean;
};

const defaultSettings: WorkspaceSettings = {
  enableCollect: true,
};

export function readWorkspaceSettings(): WorkspaceSettings {
  if (typeof window === "undefined") return { ...defaultSettings };
  return {
    enableCollect: localStorage.getItem(STORAGE_ENABLE_COLLECT) !== "false",
  };
}

export function writeWorkspaceSettings(partial: Partial<WorkspaceSettings>): WorkspaceSettings {
  const current = readWorkspaceSettings();
  const next: WorkspaceSettings = { ...current, ...partial };
  if (typeof window !== "undefined" && partial.enableCollect !== undefined) {
    localStorage.setItem(STORAGE_ENABLE_COLLECT, next.enableCollect ? "true" : "false");
  }
  return next;
}
