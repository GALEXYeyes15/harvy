import { describe, expect, it } from "vitest";
import { Schema } from "@tiptap/pm/model";
import { isDocumentVisuallyBlank } from "./harvyPlaceholder";

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { group: "block", content: "inline*" },
    heading: { group: "block", content: "inline*", attrs: { level: { default: 1 } } },
    text: { group: "inline" },
    hardBreak: { group: "inline", inline: true, selectable: false, linebreakReplacement: true },
    horizontalRule: { group: "block" },
  },
});

describe("isDocumentVisuallyBlank", () => {
  it("is true for a single empty paragraph", () => {
    const doc = schema.node("doc", null, [schema.node("paragraph")]);
    expect(isDocumentVisuallyBlank(doc)).toBe(true);
  });

  it("is true for a paragraph that only contains a hard break", () => {
    const doc = schema.node("doc", null, [
      schema.node("paragraph", null, [schema.node("hardBreak")]),
    ]);
    expect(isDocumentVisuallyBlank(doc)).toBe(true);
  });

  it("is true for multiple empty paragraphs", () => {
    const doc = schema.node("doc", null, [schema.node("paragraph"), schema.node("paragraph")]);
    expect(isDocumentVisuallyBlank(doc)).toBe(true);
  });

  it("is false when there is text", () => {
    const doc = schema.node("doc", null, [
      schema.node("paragraph", null, [schema.text("hello")]),
    ]);
    expect(isDocumentVisuallyBlank(doc)).toBe(false);
  });

  it("is false when a horizontal rule is present", () => {
    const doc = schema.node("doc", null, [
      schema.node("horizontalRule"),
      schema.node("paragraph"),
    ]);
    expect(isDocumentVisuallyBlank(doc)).toBe(false);
  });
});
