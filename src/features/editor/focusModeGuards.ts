import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, TextSelection, type EditorState, type Transaction } from "@tiptap/pm/state";

const FOCUS_MODE_BLOCKED_KEYS = new Set([
  "Backspace",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "PageUp",
  "PageDown",
  "Home",
  "End",
]);

export const focusModeGuardsKey = new PluginKey("focusModeGuards");

/**
 * Focus mode is forward-only: any range selection (native Select All menu, drag, find, etc.)
 * collapses to a caret at the end of the document so typing can never replace text.
 */
export function collapseFocusModeSelection(state: EditorState): Transaction | null {
  if (state.selection.empty) return null;
  return state.tr.setSelection(TextSelection.atEnd(state.doc)).setMeta("addToHistory", false);
}

/**
 * When `storage.enabled` is true, Backspace, arrow, page/scroll keys, and Select All are
 * swallowed, and range selections are collapsed (Focus mode).
 * Priority above empty-block Backspace so Focus mode wins.
 */
export const FocusModeGuards = Extension.create({
  name: "focusModeGuards",
  priority: 10001,

  addStorage() {
    return {
      enabled: false,
    };
  },

  addKeyboardShortcuts() {
    return {
      Backspace: () => Boolean(this.storage.enabled),
      ArrowLeft: () => Boolean(this.storage.enabled),
      ArrowRight: () => Boolean(this.storage.enabled),
      ArrowUp: () => Boolean(this.storage.enabled),
      ArrowDown: () => Boolean(this.storage.enabled),
      PageUp: () => Boolean(this.storage.enabled),
      PageDown: () => Boolean(this.storage.enabled),
      Home: () => Boolean(this.storage.enabled),
      End: () => Boolean(this.storage.enabled),
      "Mod-a": () => Boolean(this.storage.enabled),
    };
  },

  addProseMirrorPlugins() {
    const storage = this.storage;
    return [
      new Plugin({
        key: focusModeGuardsKey,
        appendTransaction: (_transactions, _oldState, newState) =>
          storage.enabled ? collapseFocusModeSelection(newState) : null,
      }),
    ];
  },
});

export function isFocusModeBlockedKey(key: string): boolean {
  return FOCUS_MODE_BLOCKED_KEYS.has(key);
}

/** Select All in any casing / modifier layout (Cmd+A on Mac, Ctrl+A elsewhere). */
export function isFocusModeSelectAllKey(event: Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey">): boolean {
  return (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a";
}
