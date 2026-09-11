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
      { id: "save-as", action: "Save As…", keys: ["Mod", "Shift", "S"] },
      { id: "export-pdf", action: "Export as PDF…", keys: ["Mod", "Shift", "E"] },
      { id: "print", action: "Print…", keys: ["Mod", "P"] },
    ],
  },
  {
    id: "view",
    title: "View",
    items: [
      { id: "open-notes", action: "Open Notes window", keys: ["Mod", "N"] },
      { id: "open-write", action: "Open Write", keys: ["Mod", "W"] },
      {
        id: "open-research",
        action: "Open Research",
        keys: ["Mod", "R"],
        note: "When Research is enabled in Settings",
      },
      { id: "toggle-left-sidebar", action: "Toggle left sidebar", keys: ["Option", "ArrowLeft"] },
      { id: "toggle-right-sidebar", action: "Toggle right sidebar", keys: ["Option", "ArrowRight"] },
      {
        id: "toggle-both-sidebars",
        action: "Toggle both sidebars",
        keys: ["Option", "ArrowDown"],
        note: "Same on/off switch as the bottom-bar control",
      },
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
        id: "em-dash",
        action: "Em dash",
        keys: ["-", "-"],
        note: "Converts to — while typing",
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
    case "ArrowLeft":
      return "←";
    case "ArrowRight":
      return "→";
    case "ArrowDown":
      return "↓";
    case "ArrowUp":
      return "↑";
    default:
      return key;
  }
}

/** Human-readable key labels for the current platform. */
export function formatHotkeyKeys(keys: string[], mac = isMacOSPlatform()): string[] {
  return keys.map((key) => symbolForKey(key, mac));
}

/** Compact chord for titles and aria hints, e.g. ⌥← or Alt+←. */
export function formatHotkeyChord(keys: string[], mac = isMacOSPlatform()): string {
  const labels = formatHotkeyKeys(keys, mac);
  return mac ? labels.join("") : labels.join("+");
}

export type ViewHotkey = "notes" | "write" | "research";

/** Cmd/Ctrl + N / W / R. Ignores repeats and extra modifiers. */
export function matchViewHotkey(event: {
  key: string;
  altKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  repeat?: boolean;
}): ViewHotkey | null {
  if (event.repeat) return null;
  if (event.altKey || event.shiftKey) return null;
  if (!(event.metaKey || event.ctrlKey)) return null;
  const key = event.key.toLowerCase();
  if (key === "n") return "notes";
  if (key === "w") return "write";
  if (key === "r") return "research";
  return null;
}

export type SidebarToggleHotkey = "left" | "right" | "both";

/** Option/Alt + arrow sidebar toggles. Ignores repeats and other modifiers. */
export function matchSidebarToggleHotkey(event: {
  key: string;
  altKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  repeat?: boolean;
}): SidebarToggleHotkey | null {
  if (event.repeat) return null;
  if (!event.altKey || event.metaKey || event.ctrlKey || event.shiftKey) return null;
  if (event.key === "ArrowLeft") return "left";
  if (event.key === "ArrowRight") return "right";
  if (event.key === "ArrowDown") return "both";
  return null;
}
