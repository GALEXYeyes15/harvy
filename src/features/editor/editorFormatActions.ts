import type { Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import type { EditorCommand } from "./commands";
import { hrefForEditorLink } from "./linkUrlValidation";

export type LinkFormatOptions = { linkHref: string | null };

const EDITOR_LINK_CLASS =
  "harvy-editor-link underline decoration-from-font underline-offset-[0.12em]";

/** Apply a link to an exact document range, matching the floating-menu embed. */
export function setLinkOnView(view: EditorView, from: number, to: number, href: string): boolean {
  const markType = view.state.schema.marks.link;
  if (!markType || from >= to) return false;
  const finalHref = hrefForEditorLink(href);
  if (!finalHref) return false;

  const attrs: { href: string; class?: string } = { href: finalHref };
  if (markType.spec.attrs && "class" in markType.spec.attrs) {
    attrs.class = EDITOR_LINK_CLASS;
  }

  let tr = view.state.tr.addMark(from, to, markType.create(attrs));
  try {
    tr = tr.setSelection(TextSelection.create(tr.doc, from, to));
  } catch {
    // Keep the current selection if the range is no longer valid.
  }
  view.dispatch(tr);
  return true;
}

export function setLinkOnRange(editor: Editor, from: number, to: number, href: string): boolean {
  return setLinkOnView(editor.view, from, to, href);
}

/** Apply a formatting command using TipTap / ProseMirror (no markdown string insertion). */
export function runEditorFormat(
  editor: Editor,
  command: EditorCommand,
  opts?: LinkFormatOptions,
): void {
  const chain = editor.chain().focus();

  switch (command) {
    case "bold":
      chain.toggleBold().run();
      break;
    case "italic":
      chain.toggleItalic().run();
      break;
    case "underline":
      chain.toggleUnderline().run();
      break;
    case "h1":
      chain.toggleHeading({ level: 1 }).run();
      break;
    case "h2":
      chain.toggleHeading({ level: 2 }).run();
      break;
    case "h3":
      chain.toggleHeading({ level: 3 }).run();
      break;
    case "quote":
      chain.toggleBlockquote().run();
      break;
    case "bullets":
      chain.toggleBulletList().run();
      break;
    case "numbers":
      chain.toggleOrderedList().run();
      break;
    case "link": {
      const href = opts?.linkHref;
      if (href === null || href === "") {
        if (editor.isActive("link")) {
          chain.extendMarkRange("link").unsetLink().run();
        }
      } else if (href) {
        chain.extendMarkRange("link").setLink({ href }).run();
      }
      break;
    }
    case "comment":
      break;
    default:
      break;
  }
}
