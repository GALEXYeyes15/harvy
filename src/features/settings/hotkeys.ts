import { isMacOSPlatform } from "../save/saveRuntime";

export type HotkeyDefinition = {
  id: string;
  action: string;
  /** Keys in display order, e.g. ["Mod", "S"] or ["---"]. */
  keys: string[];
  note?: string;
};

export type HotkeyGroup = {
  id: string;
  title: string;
  items: HotkeyDefinition[];
};

/** Canonical shortcut reference shown in Settings → Shortcuts. */
export const HOTKEY_GROUPS: HotkeyGroup[] = [
  {
    id: "file",
    title: "File",
    items: [
      { id: "save", action: "Save", keys: ["Mod", "S"] },
      { id: "save-as", action: "Save As File…", keys: ["Mod", "Shift", "S"] },
      { id: "export-pdf", action: "Export as PDF…", keys: ["Mod", "Shift", "E"] },
    ],
  },
  {
    id: "edit",
    title: "Edit",
    items: [
      { id: "undo", action: "Undo", keys: ["Mod", "Z"] },
      { id: "redo", action: "Redo", keys: ["Mod", "Shift", "Z"] },
      { id: "cut", action: "Cut", keys: ["Mod", "X"] },
      { id: "copy", action: "Copy", keys: ["Mod", "C"] },
      { id: "paste", action: "Paste", keys: ["Mod", "V"] },
      { id: "select-all", action: "Select All", keys: ["Mod", "A"] },
    ],
  },
  {
    id: "formatting",
    title: "Formatting",
    items: [
      { id: "bold", action: "Bold", keys: ["Mod", "B"] },
      { id: "italic", action: "Italic", keys: ["Mod", "I"] },
      { id: "underline", action: "Underline", keys: ["Mod", "U"] },
    ],
  },
  {
    id: "markdown",
    title: "Markdown typing",
    items: [
      {
        id: "heading-1",
        action: "Heading 1",
        keys: ["#", "Space"],
        note: "At the start of a paragraph",
      },
      {
        id: "heading-2",
        action: "Heading 2",
        keys: ["#", "#", "Space"],
        note: "At the start of a paragraph",
      },
      {
        id: "heading-3",
        action: "Heading 3",
        keys: ["#", "#", "#", "Space"],
        note: "At the start of a paragraph",
      },
      {
        id: "bullet",
        action: "Bullet list",
        keys: ["-", "Space"],
        note: "Also * or + followed by Space",
      },
      {
        id: "numbered",
        action: "Numbered list",
        keys: ["1", ".", "Space"],
        note: "Also 1) Space",
      },
      {
        id: "divider",
        action: "Horizontal divider",
        keys: ["-", "-", "-"],
        note: "At the start of a paragraph",
      },
    ],
  },
  {
    id: "lists",
    title: "Lists",
    items: [
      { id: "indent", action: "Indent list item", keys: ["Tab"] },
      { id: "outdent", action: "Outdent list item", keys: ["Shift", "Tab"] },
      {
        id: "exit-list",
        action: "Exit list",
        keys: ["Enter"],
        note: "On an empty list item",
      },
    ],
  },
  {
    id: "blocks",
    title: "Blocks",
    items: [
      {
        id: "select-divider",
        action: "Select divider above",
        keys: ["Backspace"],
        note: "At the start of the line below a divider",
      },
      {
        id: "delete-divider",
        action: "Delete selected divider",
        keys: ["Backspace"],
        note: "When the divider is highlighted",
      },
      {
        id: "delete-empty",
        action: "Delete empty paragraph",
        keys: ["Backspace"],
        note: "In an empty text block",
      },
    ],
  },
];

function symbolForKey(key: string, mac: boolean): string {
  switch (key) {
    case "Mod":
      return mac ? "⌘" : "Ctrl";
    case "Shift":
      return mac ? "⇧" : "Shift";
    case "Alt":
    case "Option":
      return mac ? "⌥" : "Alt";
    case "Backspace":
      return mac ? "⌫" : "Backspace";
    case "Enter":
      return mac ? "↩" : "Enter";
    case "Tab":
      return "Tab";
    case "Space":
      return "Space";
    default:
      return key;
  }
}

/** Human-readable key labels for the current platform. */
export function formatHotkeyKeys(keys: string[], mac = isMacOSPlatform()): string[] {
  return keys.map((key) => symbolForKey(key, mac));
}
