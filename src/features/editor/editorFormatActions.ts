import type { Editor } from "@tiptap/core";
import type { EditorCommand } from "./commands";

export type LinkFormatOptions = { linkHref: string | null };

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
