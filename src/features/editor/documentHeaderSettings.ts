const STORAGE_SHOW_TITLE = "harvy:show-document-title";
const STORAGE_SHOW_SUBTITLE = "harvy:show-document-subtitle";

export type DocumentHeaderPrefs = {
  showTitle: boolean;
  showSubtitle: boolean;
};

const defaultPrefs: DocumentHeaderPrefs = {
  showTitle: true,
  showSubtitle: true,
};

function readBool(key: string, defaultValue: boolean): boolean {
  const raw = localStorage.getItem(key);
  if (raw === null) return defaultValue;
  return raw !== "false";
}

export function readDocumentHeaderPrefs(): DocumentHeaderPrefs {
  if (typeof window === "undefined") return { ...defaultPrefs };
  return {
    showTitle: readBool(STORAGE_SHOW_TITLE, defaultPrefs.showTitle),
    showSubtitle: readBool(STORAGE_SHOW_SUBTITLE, defaultPrefs.showSubtitle),
  };
}

export function writeDocumentHeaderPrefs(
  partial: Partial<DocumentHeaderPrefs>,
): DocumentHeaderPrefs {
  const current = readDocumentHeaderPrefs();
  const next: DocumentHeaderPrefs = { ...current, ...partial };
  if (typeof window !== "undefined") {
    if (partial.showTitle !== undefined) {
      localStorage.setItem(STORAGE_SHOW_TITLE, next.showTitle ? "true" : "false");
    }
    if (partial.showSubtitle !== undefined) {
      localStorage.setItem(STORAGE_SHOW_SUBTITLE, next.showSubtitle ? "true" : "false");
    }
  }
  return next;
}
