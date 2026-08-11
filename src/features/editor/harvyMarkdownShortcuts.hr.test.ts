import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { NodeSelection } from "@tiptap/pm/state";
import { describe, expect, it } from "vitest";
import { editorHtmlToMarkdown, toEditorHtml } from "./documentMarkdown";
import { handleBackspaceOnEmptyTextBlockKeyDown } from "./emptyTextBlockDeletion";
import { EmptyTextBlockBackspace } from "./emptyTextBlockBackspace";
import { HarvyMarkdownShortcuts } from "./harvyMarkdownShortcuts";
import { HarvyParagraph } from "./harvyParagraph";

function createEditor(content = "<p></p>") {
  return new Editor({
    extensions: [
      StarterKit.configure({ paragraph: false }),
      HarvyParagraph,
      HarvyMarkdownShortcuts,
      EmptyTextBlockBackspace,
    ],
    content,
    enableInputRules: ["harvyMarkdownShortcuts"],
  });
}

function typeText(ed: Editor, text: string) {
  for (const ch of text) {
    const { from, to } = ed.state.selection;
    const handled = ed.view.someProp("handleTextInput", (handler) =>
      (handler as (view: typeof ed.view, from: number, to: number, text: string) => boolean)(
        ed.view,
        from,
        to,
        ch,
      ),
    );
    if (!handled) {
      ed.view.dispatch(ed.state.tr.insertText(ch, from, to));
    }
  }
}

describe("horizontal rule markdown shortcut", () => {
  it("exposes horizontalRule in the schema when shortcuts are enabled", () => {
    const ed = createEditor();
    try {
      expect(ed.schema.nodes.horizontalRule).toBeTruthy();
      expect(ed.extensionManager.extensions.some((ext) => ext.name === "harvyMarkdownShortcuts")).toBe(
        true,
      );
    } finally {
      ed.destroy();
    }
  });

  it("inserts a divider when typing --- in an empty paragraph", () => {
    const ed = createEditor();
    try {
      ed.commands.focus("start");
      typeText(ed, "---");

      expect(ed.getHTML()).toMatch(/<hr/i);
      let found = false;
      ed.state.doc.forEach((node) => {
        if (node.type.name === "horizontalRule") found = true;
      });
      expect(found).toBe(true);
    } finally {
      ed.destroy();
    }
  });

  it("converts -- to an em dash while typing", () => {
    const ed = createEditor("<p>Hello world</p>");
    try {
      ed.commands.focus("end");
      typeText(ed, "--");
      expect(ed.getText()).toBe("Hello world—");
      expect(ed.getHTML()).not.toMatch(/<hr/i);
    } finally {
      ed.destroy();
    }
  });

  it("deletes a selected horizontal rule on Backspace", () => {
    const ed = createEditor("<p>Before</p><hr><p>After</p>");
    try {
      let hrPos: number | null = null;
      ed.state.doc.forEach((node, pos) => {
        if (node.type.name === "horizontalRule") hrPos = pos;
      });
      expect(hrPos).not.toBeNull();
      ed.commands.setNodeSelection(hrPos!);

      const handled = handleBackspaceOnEmptyTextBlockKeyDown(
        ed.view,
        new KeyboardEvent("keydown", { key: "Backspace", bubbles: true, cancelable: true }),
      );
      expect(handled).toBe(true);
      expect(ed.getHTML()).not.toMatch(/<hr/i);
      expect(ed.getHTML()).toContain("Before");
      expect(ed.getHTML()).toContain("After");
    } finally {
      ed.destroy();
    }
  });

  it("deletes the divider when Backspace is pressed at the start of the following paragraph", () => {
    const ed = createEditor("<p>Before</p><hr><p></p>");
    try {
      // Place caret at start of the empty paragraph after the HR.
      let afterHrPos = 1;
      ed.state.doc.forEach((node, pos) => {
        if (node.type.name === "horizontalRule") afterHrPos = pos + node.nodeSize + 1;
      });
      ed.commands.setTextSelection(afterHrPos);

      const first = handleBackspaceOnEmptyTextBlockKeyDown(
        ed.view,
        new KeyboardEvent("keydown", { key: "Backspace", bubbles: true, cancelable: true }),
      );
      expect(first).toBe(true);
      expect(ed.state.selection).toBeInstanceOf(NodeSelection);
      expect((ed.state.selection as NodeSelection).node.type.name).toBe("horizontalRule");
      expect(ed.getHTML()).toMatch(/<hr/i);

      const second = handleBackspaceOnEmptyTextBlockKeyDown(
        ed.view,
        new KeyboardEvent("keydown", { key: "Backspace", bubbles: true, cancelable: true }),
      );
      expect(second).toBe(true);
      expect(ed.getHTML()).not.toMatch(/<hr/i);
    } finally {
      ed.destroy();
    }
  });

  it("round-trips horizontal rules through markdown save/reload", () => {
    const ed = createEditor("<p>Before</p><hr><p>After</p>");
    try {
      const before = editorHtmlToMarkdown(ed.getHTML());
      expect(before).toMatch(/(-{3}|\*{3}|\* \* \*)/);
      const html = toEditorHtml(before, { sourcePath: "doc.md" });
      expect(html).toMatch(/<hr\b/i);
      const after = editorHtmlToMarkdown(html);
      expect(after).toMatch(/(-{3}|\*{3}|\* \* \*)/);
      expect(after.includes("Before")).toBe(true);
      expect(after.includes("After")).toBe(true);
    } finally {
      ed.destroy();
    }
  });
});
