import type { Editor } from "@tiptap/core";
import type { HarvyImageLoadAttrs } from "./harvyImageAttribution";
import type { HarvyImageWidth } from "./harvyImage";

export type { HarvyImageLoadAttrs } from "./harvyImageAttribution";

export function insertHarvyImagePlaceholderAtCursor(editor: Editor): boolean {
  return editor.chain().focus().insertHarvyImagePlaceholder().run();
}

export function insertHarvyImageAtCursor(
  editor: Editor,
  attrs: { src: string; caption?: string; width?: HarvyImageWidth },
): boolean {
  return editor.chain().focus().insertHarvyImage(attrs).run();
}

export function loadHarvyImageAt(editor: Editor, pos: number, attrs: HarvyImageLoadAttrs): boolean {
  return editor.chain().focus().loadHarvyImageAt(pos, attrs).run();
}

export function replaceHarvyImageAt(
  editor: Editor,
  pos: number,
  attrs: { src: string },
): boolean {
  return editor.chain().focus().replaceHarvyImageAt(pos, attrs).run();
}
