import { afterEach, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { TextSelection } from "@tiptap/pm/state";
import { FocusModeGuards, isFocusModeSelectAllKey } from "./focusModeGuards";

let editor: Editor | null = null;

function createEditor(enabled: boolean): Editor {
  editor = new Editor({
    extensions: [StarterKit, FocusModeGuards],
    content: "<p>First paragraph.</p><p>Second paragraph.</p>",
  });
  editor.storage.focusModeGuards.enabled = enabled;
  return editor;
}

afterEach(() => {
  editor?.destroy();
  editor = null;
});

describe("FocusModeGuards selection", () => {
  it("collapses Select All to a caret at the end of the document in Focus mode", () => {
    const ed = createEditor(true);
    ed.commands.selectAll();
    expect(ed.state.selection.empty).toBe(true);
    expect(ed.state.selection.head).toBe(TextSelection.atEnd(ed.state.doc).head);
  });

  it("collapses a range selection so typing cannot replace text", () => {
    const ed = createEditor(true);
    ed.commands.setTextSelection({ from: 2, to: 8 });
    ed.commands.insertContent("x");
    expect(ed.getText()).toContain("First paragraph.");
    expect(ed.getText()).toContain("Second paragraph.x");
  });

  it("leaves selection alone outside Focus mode", () => {
    const ed = createEditor(false);
    ed.commands.selectAll();
    expect(ed.state.selection.empty).toBe(false);
  });
});

describe("isFocusModeSelectAllKey", () => {
  it("matches Cmd+A and Ctrl+A only", () => {
    expect(isFocusModeSelectAllKey({ key: "a", metaKey: true, ctrlKey: false })).toBe(true);
    expect(isFocusModeSelectAllKey({ key: "A", metaKey: false, ctrlKey: true })).toBe(true);
    expect(isFocusModeSelectAllKey({ key: "a", metaKey: false, ctrlKey: false })).toBe(false);
  });
});
