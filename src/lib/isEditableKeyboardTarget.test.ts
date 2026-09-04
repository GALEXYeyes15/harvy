import { describe, expect, it } from "vitest";
import { isDocumentNameKeyboardTarget, isEditableKeyboardTarget } from "../lib/isEditableKeyboardTarget";

describe("isEditableKeyboardTarget", () => {
  it("returns true for input, textarea, select, and contenteditable", () => {
    const input = document.createElement("input");
    const textarea = document.createElement("textarea");
    const select = document.createElement("select");
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    const nested = document.createElement("span");
    editable.appendChild(nested);

    expect(isEditableKeyboardTarget(input)).toBe(true);
    expect(isEditableKeyboardTarget(textarea)).toBe(true);
    expect(isEditableKeyboardTarget(select)).toBe(true);
    expect(isEditableKeyboardTarget(editable)).toBe(true);
    expect(isEditableKeyboardTarget(nested)).toBe(true);
  });

  it("returns false for ordinary elements", () => {
    expect(isEditableKeyboardTarget(document.createElement("div"))).toBe(false);
    expect(isEditableKeyboardTarget(document.createElement("button"))).toBe(false);
    expect(isEditableKeyboardTarget(null)).toBe(false);
  });
});

describe("isDocumentNameKeyboardTarget", () => {
  it("returns true only for the document name field", () => {
    const name = document.createElement("input");
    name.setAttribute("aria-label", "Document name");
    const other = document.createElement("input");
    other.setAttribute("aria-label", "Search");

    expect(isDocumentNameKeyboardTarget(name)).toBe(true);
    expect(isDocumentNameKeyboardTarget(other)).toBe(false);
    expect(isDocumentNameKeyboardTarget(document.createElement("div"))).toBe(false);
  });
});
