const STORAGE_TOP_BAR = "harvy:keep-top-bar-visible-while-typing";
const STORAGE_DOCUMENT_TITLE = "harvy:keep-document-title-visible-while-typing";
const STORAGE_BOTTOM_TOOLS = "harvy:keep-bottom-tools-visible-while-typing";

export type FocusVisibilityPrefs = {
  keepTopBarVisibleWhileTyping: boolean;
  keepDocumentTitleVisibleWhileTyping: boolean;
  keepBottomToolsVisibleWhileTyping: boolean;
};

const defaultPrefs: FocusVisibilityPrefs = {
  keepTopBarVisibleWhileTyping: false,
  keepDocumentTitleVisibleWhileTyping: false,
  keepBottomToolsVisibleWhileTyping: false,
};

export function readFocusVisibilityPrefs(): FocusVisibilityPrefs {
  if (typeof window === "undefined") return { ...defaultPrefs };
  return {
    keepTopBarVisibleWhileTyping: localStorage.getItem(STORAGE_TOP_BAR) === "true",
    keepDocumentTitleVisibleWhileTyping: localStorage.getItem(STORAGE_DOCUMENT_TITLE) === "true",
    keepBottomToolsVisibleWhileTyping: localStorage.getItem(STORAGE_BOTTOM_TOOLS) === "true",
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
    if (partial.keepBottomToolsVisibleWhileTyping !== undefined) {
      localStorage.setItem(
        STORAGE_BOTTOM_TOOLS,
        next.keepBottomToolsVisibleWhileTyping ? "true" : "false",
      );
    }
  }
  return next;
}
