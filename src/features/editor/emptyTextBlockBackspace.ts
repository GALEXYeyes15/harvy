import { Extension } from "@tiptap/core";
import { handleBackspaceOnEmptyTextBlockKeyDown } from "./emptyTextBlockDeletion";

/**
 * Substack-style Backspace for empty blocks below images, plus Notion-style empty block deletion.
 * Keyboard shortcuts run before TipTap's built-in Keymap (`joinBackward` / `selectNodeBackward`).
 * `EditorCanvas` also wires the same handler via `editorProps.handleKeyDown` (first in ProseMirror's chain).
 */
export const EmptyTextBlockBackspace = Extension.create({
  name: "emptyTextBlockBackspace",
  priority: 10000,

  addKeyboardShortcuts() {
    return {
      Backspace: ({ editor }) =>
        handleBackspaceOnEmptyTextBlockKeyDown(
          editor.view,
          new KeyboardEvent("keydown", {
            key: "Backspace",
            bubbles: true,
            cancelable: true,
          }),
        ),
    };
  },
});
