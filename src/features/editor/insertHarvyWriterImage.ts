import type { Editor } from "@tiptap/core";
import type { HarvyWriterImageLoadAttrs } from "./harvyWriterImageAttribution";
import type { HarvyWriterImageWidth } from "./harvyWriterImage";

export type { HarvyWriterImageLoadAttrs } from "./harvyWriterImageAttribution";

export function insertHarvyWriterImagePlaceholderAtCursor(editor: Editor): boolean {
  return editor.chain().focus().insertHarvyWriterImagePlaceholder().run();
}

export function insertHarvyWriterImageAtCursor(
  editor: Editor,
  attrs: { src: string; caption?: string; width?: HarvyWriterImageWidth },
): boolean {
  return editor.chain().focus().insertHarvyWriterImage(attrs).run();
}

export function loadHarvyWriterImageAt(editor: Editor, pos: number, attrs: HarvyWriterImageLoadAttrs): boolean {
  return editor.chain().focus().loadHarvyWriterImageAt(pos, attrs).run();
}

export function replaceHarvyWriterImageAt(
  editor: Editor,
  pos: number,
  attrs: { src: string },
): boolean {
  return editor.chain().focus().replaceHarvyWriterImageAt(pos, attrs).run();
}
