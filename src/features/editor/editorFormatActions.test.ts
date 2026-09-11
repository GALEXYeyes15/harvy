import { describe, expect, it } from "vitest";
import { Schema } from "@tiptap/pm/model";
import { EditorState } from "@tiptap/pm/state";
import { EditorView } from "@tiptap/pm/view";
import { setLinkOnView } from "./editorFormatActions";
import { hrefForEditorLink } from "./linkUrlValidation";

const schema = new Schema({
  nodes: {
    doc: { content: "block+", toDOM: () => ["div", 0] },
    paragraph: { group: "block", content: "inline*", toDOM: () => ["p", 0] },
    text: { group: "inline", marks: "_" },
  },
  marks: {
    link: {
      attrs: {
        href: { default: null },
        class: { default: null },
      },
      inclusive: false,
      parseDOM: [{ tag: "a[href]" }],
      toDOM: (mark) => ["a", { href: mark.attrs.href, class: mark.attrs.class }, 0],
    },
  },
});

function viewWithText(text: string): EditorView {
  const doc = schema.node("doc", null, [schema.node("paragraph", null, [schema.text(text)])]);
  const state = EditorState.create({ schema, doc });
  const mount = document.createElement("div");
  document.body.appendChild(mount);
  return new EditorView(mount, { state });
}

describe("setLinkOnView", () => {
  it("wraps the exact range in a link mark", () => {
    const view = viewWithText("train a new barista at work");
    const from = 1;
    const to = 1 + "train a new barista at work".length;
    expect(setLinkOnView(view, from, to, "https://alex.substack.com/p/barista")).toBe(true);

    const marks = new Set<string>();
    view.state.doc.nodesBetween(from, to, (node) => {
      if (!node.isText) return;
      for (const mark of node.marks) {
        if (mark.type.name === "link") marks.add(String(mark.attrs.href));
      }
    });
    expect([...marks]).toEqual(["https://alex.substack.com/p/barista"]);
    view.destroy();
  });
});

describe("hrefForEditorLink", () => {
  it("keeps published and Notion URLs", () => {
    expect(hrefForEditorLink("https://alex.substack.com/p/hello")).toBe(
      "https://alex.substack.com/p/hello",
    );
    expect(hrefForEditorLink("https://www.notion.so/0123456789abcdef0123456789abcdef")).toContain(
      "notion.so",
    );
  });
});
