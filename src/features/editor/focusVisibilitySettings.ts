const STORAGE_TOP_BAR = "harvy:keep-top-bar-visible-while-typing";
const STORAGE_DOCUMENT_TITLE = "harvy:keep-document-title-visible-while-typing";

export type FocusVisibilityPrefs = {
  keepTopBarVisibleWhileTyping: boolean;
  keepDocumentTitleVisibleWhileTyping: boolean;
};

const defaultPrefs: FocusVisibilityPrefs = {
  keepTopBarVisibleWhileTyping: false,
  keepDocumentTitleVisibleWhileTyping: false,
};

export function readFocusVisibilityPrefs(): FocusVisibilityPrefs {
  if (typeof window === "undefined") return { ...defaultPrefs };
  return {
    keepTopBarVisibleWhileTyping: localStorage.getItem(STORAGE_TOP_BAR) === "true",
    keepDocumentTitleVisibleWhileTyping: localStorage.getItem(STORAGE_DOCUMENT_TITLE) === "true",
  };
}

export function writeFocusVisibilityPrefs(
  partial: Partial<FocusVisibilityPrefs>,
): FocusVisibilityPrefs {
  const current = readFocusVisibilityPrefs();
  const next: FocusVisibilityPrefs = { ...current, ...partial };
  if (typeof window !== "undefined") {
    if (partial.keepTopBarVisibleWhileTyping !== undefined) {
      localStorage.setItem(STORAGE_TOP_BAR, next.keepTopBarVisibleWhileTyping ? "true" : "false");
    }
    if (partial.keepDocumentTitleVisibleWhileTyping !== undefined) {
      localStorage.setItem(
        STORAGE_DOCUMENT_TITLE,
        next.keepDocumentTitleVisibleWhileTyping ? "true" : "false",
      );
    }
  }
  return next;
}
