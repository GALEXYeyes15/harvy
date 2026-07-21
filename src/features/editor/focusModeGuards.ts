import { Extension } from "@tiptap/core";

const FOCUS_MODE_BLOCKED_KEYS = new Set([
  "Backspace",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
]);

/**
 * When `storage.enabled` is true, Backspace and arrow keys are swallowed (Focus mode).
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
    };
  },
});

export function isFocusModeBlockedKey(key: string): boolean {
  return FOCUS_MODE_BLOCKED_KEYS.has(key);
}
