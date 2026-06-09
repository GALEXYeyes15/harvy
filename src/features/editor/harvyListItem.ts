import ListItem from "@tiptap/extension-list-item";

/**
 * List items with optional virtual indent for first-in-list Tab nesting
 * (when ProseMirror `sinkListItem` has no previous sibling).
 */
export const HarvyListItem = ListItem.extend({
  addAttributes() {
    return {
      indentLevel: {
        default: 0,
        parseHTML: (element) => {
          const raw = element.getAttribute("data-harvy-indent-level");
          const parsed = raw ? Number.parseInt(raw, 10) : 0;
          return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
        },
        renderHTML: (attributes) => {
          const level = attributes.indentLevel as number;
          if (!level || level <= 0) return {};
          return { "data-harvy-indent-level": String(level) };
        },
      },
      harvyVisualDepth: {
        default: null as number | null,
        parseHTML: (element) => {
          const raw = element.getAttribute("data-harvy-visual-depth");
          const parsed = raw ? Number.parseInt(raw, 10) : null;
          return parsed != null && Number.isFinite(parsed) && parsed > 0 ? parsed : null;
        },
        renderHTML: (attributes) => {
          const depth = attributes.harvyVisualDepth as number | null;
          if (depth == null || depth <= 0) return {};
          return { "data-harvy-visual-depth": String(depth) };
        },
      },
    };
  },

  addKeyboardShortcuts() {
    return {
      Enter: () => this.editor.commands.splitListItem(this.name),
    };
  },
});
