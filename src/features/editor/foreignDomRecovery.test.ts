import { afterEach, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { recoverForeignDocumentDom } from "./foreignDomRecovery";

let editor: Editor | null = null;

afterEach(() => {
  editor?.destroy();
  editor = null;
});

describe("foreign DOM recovery", () => {
  it("adopts text that was painted into a paragraph but never entered the document", () => {
    editor = new Editor({
      extensions: [StarterKit],
      content: "<p>what we've done.</p>",
    });
    const paragraph = editor.view.dom.querySelector("p");
    expect(paragraph).toBeTruthy();
    const extra = document.createTextNode(
      " for an Ironman triathlon, or hitting high numbers even when you're short staffed.",
    );
    paragraph!.appendChild(extra);

    const block = editor.view.nodeDOM(0);
    expect(paragraph!.textContent).toContain("Ironman");
    expect((extra as Node & { pmViewDesc?: unknown }).pmViewDesc).toBeUndefined();
    expect(block).toBe(paragraph);
    expect((paragraph!.firstChild as Node & { pmViewDesc?: unknown }).pmViewDesc).toBeTruthy();

    recoverForeignDocumentDom(editor.view);

    const text = editor.state.doc.textContent;
    expect(text).toBe(
      "what we've done. for an Ironman triathlon, or hitting high numbers even when you're short staffed.",
    );
    expect(paragraph!.textContent).toBe(text);
    const from = text.indexOf("Ironman") + 1;
    editor.commands.setTextSelection({ from, to: from + "Ironman".length });
    expect(editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to)).toBe(
      "Ironman",
    );
  });

  it("leaves a normal paragraph alone", () => {
    editor = new Editor({
      extensions: [StarterKit],
      content: "<p>what we've done.</p>",
    });
    recoverForeignDocumentDom(editor.view);
    expect(editor.state.doc.textContent).toBe("what we've done.");
  });
});
