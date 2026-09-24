import { afterEach, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { HarvyOutlineParagraph } from "./harvyOutlineParagraph";

let editor: Editor | null = null;

function createEditor(content: string): Editor {
  editor = new Editor({ extensions: [StarterKit, HarvyOutlineParagraph], content });
  return editor;
}

afterEach(() => {
  editor?.destroy();
  editor = null;
});

describe("HarvyOutlineParagraph empty doc", () => {
  it("refills a cleared document with a plain paragraph", () => {
    const ed = createEditor("<h2>Hello</h2><p>More text</p>");
    ed.commands.selectAll();
    ed.commands.deleteSelection();
    expect(ed.state.doc.childCount).toBe(1);
    expect(ed.state.doc.firstChild?.type.name).toBe("paragraph");
  });

  it("keeps a lone placeholder that carries a scaffold hint", () => {
    const ed = createEditor(
      '<p data-harvy-outline-kind="placeholder" data-harvy-outline-scaffold="Open with a hook"></p><p>x</p>',
    );
    const second = ed.state.doc.child(0).nodeSize;
    ed.commands.deleteRange({ from: second, to: ed.state.doc.content.size });
    expect(ed.state.doc.childCount).toBe(1);
    expect(ed.state.doc.firstChild?.type.name).toBe("harvyOutlineParagraph");
    expect(ed.state.doc.firstChild?.attrs.writingScaffold).toBe("Open with a hook");
  });
});
