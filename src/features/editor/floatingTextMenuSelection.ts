import type { Editor } from "@tiptap/core";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";

const IMAGE_BLOCK_SELECTOR = "[data-image-block], .harvy-image-node";

/** True when focus/selection is on image chrome, not editable document text. */
function domSelectionTouchesImageBlock(): boolean {
  const active = document.activeElement;
  if (active instanceof HTMLElement && active.closest(IMAGE_BLOCK_SELECTOR)) {
    return true;
  }

  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return false;
  const anchor = sel.anchorNode;
  if (!anchor) return false;
  const el = anchor instanceof Element ? anchor : anchor.parentElement;
  return Boolean(el?.closest(IMAGE_BLOCK_SELECTOR));
}

function proseMirrorSelectionTouchesHarvyImage(editor: Editor): boolean {
  const { selection, doc } = editor.state;

  if (selection instanceof NodeSelection && selection.node.type.name === "harvyImage") {
    return true;
  }

  const testPos = (pos: number): boolean => {
    const $pos = doc.resolve(pos);
    for (let depth = $pos.depth; depth >= 0; depth--) {
      if ($pos.node(depth).type.name === "harvyImage") return true;
    }
    return false;
  };

  return testPos(selection.from) || testPos(selection.to);
}

/**
 * Whether the floating text formatting toolbar should appear for the current editor state.
 * Suppresses on image blocks, image toolbars, attribution captions, and caption inputs.
 */
export function isTextFormattingSelection(editor: Editor): boolean {
  if (domSelectionTouchesImageBlock()) return false;
  if (proseMirrorSelectionTouchesHarvyImage(editor)) return false;

  const { selection } = editor.state;
  if (!(selection instanceof TextSelection) || selection.empty) return false;

  return true;
}
