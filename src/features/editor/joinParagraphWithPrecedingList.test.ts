import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { describe, expect, it } from "vitest";
import { handleBackspaceOnEmptyTextBlockKeyDown } from "./emptyTextBlockDeletion";
import { EmptyTextBlockBackspace } from "./emptyTextBlockBackspace";
import { HarvyListItem } from "./harvyListItem";
import { HarvyListKeyboard } from "./harvyListKeyboard";
import { HarvyParagraph } from "./harvyParagraph";

function createEditor(content: string) {
  return new Editor({
    extensions: [
      StarterKit.configure({
        paragraph: false,
        listItem: false,
        orderedList: false,
        gapcursor: false,
      }),
      EmptyTextBlockBackspace,
      HarvyParagraph,
      HarvyListItem,
      HarvyListKeyboard,
    ],
    content,
    editorProps: {
      handleKeyDown: (view, event) => handleBackspaceOnEmptyTextBlockKeyDown(view, event),
    },
  });
}

function pressBackspace(ed: Editor) {
  return handleBackspaceOnEmptyTextBlockKeyDown(
    ed.view,
    new KeyboardEvent("keydown", { key: "Backspace", bubbles: true, cancelable: true }),
  );
}

function isInsideListItem(ed: Editor): boolean {
  const { $from } = ed.state.selection;
  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type.name === "listItem") return true;
  }
  return false;
}

function caretAtEndOfParagraph(ed: Editor, text: string): boolean {
  const { $from } = ed.state.selection;
  return (
    $from.parent.type.name === "paragraph" &&
    $from.parent.textContent === text &&
    $from.parentOffset === $from.parent.content.size
  );
}

describe("join paragraph with preceding list on Backspace", () => {
  it("places the caret at the end of the previous body, not the last list item", () => {
    const body = "body after the list";
    const ed = createEditor(
      `<ul><li><p>asdf</p></li><li><p>asdf</p></li></ul><p>${body}</p><p></p>`,
    );
    try {
      ed.commands.focus("end");
      expect(ed.state.selection.$from.parent.textContent).toBe("");

      const handled = pressBackspace(ed);
      expect(handled).toBe(true);
      expect(isInsideListItem(ed)).toBe(false);
      expect(caretAtEndOfParagraph(ed, body)).toBe(true);
      expect(ed.getHTML()).toContain("<ul>");
      expect(ed.getHTML()).toContain(body);
    } finally {
      ed.destroy();
    }
  });

  it("does not skip a body paragraph when an empty gap sits between the list and the body", () => {
    const body = "asdfhdfjklhaskjhdsfsasdfhjdsfkjahsdfkh";
    const ed = createEditor(
      `<ul><li><p>asdf</p></li><li><p>asdf</p></li></ul><p></p><p>${body}</p><p></p>`,
    );
    try {
      ed.commands.focus("end");
      expect(pressBackspace(ed)).toBe(true);
      expect(isInsideListItem(ed)).toBe(false);
      expect(caretAtEndOfParagraph(ed, body)).toBe(true);
      expect(ed.getHTML()).toContain(body);
    } finally {
      ed.destroy();
    }
  });

  it("moves the caret to the last list item when deleting an empty paragraph directly after a list", () => {
    const ed = createEditor(
      `<ul><li><p>asdf</p></li><li><p>asdf</p></li><li><p>asdf</p></li></ul><p></p>`,
    );
    try {
      ed.commands.focus("end");
      expect(ed.state.selection.$from.parent.textContent).toBe("");
      expect(isInsideListItem(ed)).toBe(false);

      expect(pressBackspace(ed)).toBe(true);
      expect(isInsideListItem(ed)).toBe(true);
      expect(caretAtEndOfParagraph(ed, "asdf")).toBe(true);
      expect(ed.getHTML()).toMatch(/<ul>/);
      expect(ed.getHTML()).not.toMatch(/<p><\/p>/);
    } finally {
      ed.destroy();
    }
  });

  it("still merges a paragraph that sits directly after a list into the last item", () => {
    const ed = createEditor(`<ul><li><p>item</p></li></ul><p>more</p>`);
    try {
      const lastParaStart = ed.state.doc.content.size - "more".length - 1;
      ed.commands.setTextSelection(lastParaStart);
      expect(ed.state.selection.$from.parent.textContent).toBe("more");
      expect(ed.state.selection.$from.parentOffset).toBe(0);

      expect(pressBackspace(ed)).toBe(true);
      expect(isInsideListItem(ed)).toBe(true);
      expect(ed.state.selection.$from.parent.textContent).toBe("itemmore");
    } finally {
      ed.destroy();
    }
  });
});
