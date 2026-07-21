import { describe, expect, it } from "vitest";
import { applyNotesTabIndent, NOTES_INDENT } from "./notesTextareaIndent";

describe("applyNotesTabIndent", () => {
  it("indents the current line on Tab", () => {
    const value = "- Belief systems\nhabitual";
    const result = applyNotesTabIndent({
      value,
      selectionStart: 0,
      selectionEnd: 0,
      shiftKey: false,
    });
    expect(result.value).toBe(`${NOTES_INDENT}- Belief systems\nhabitual`);
    expect(result.selectionStart).toBe(NOTES_INDENT.length);
    expect(result.selectionEnd).toBe(NOTES_INDENT.length);
  });

  it("indents every selected line on Tab", () => {
    const value = "a\nb\nc";
    const result = applyNotesTabIndent({
      value,
      selectionStart: 0,
      selectionEnd: 3,
      shiftKey: false,
    });
    expect(result.value).toBe(`${NOTES_INDENT}a\n${NOTES_INDENT}b\nc`);
  });

  it("outdents with Shift+Tab", () => {
    const value = `${NOTES_INDENT}- Belief systems`;
    const result = applyNotesTabIndent({
      value,
      selectionStart: value.length,
      selectionEnd: value.length,
      shiftKey: true,
    });
    expect(result.value).toBe("- Belief systems");
  });

  it("outdents a leading tab character", () => {
    const result = applyNotesTabIndent({
      value: "\titem",
      selectionStart: 1,
      selectionEnd: 1,
      shiftKey: true,
    });
    expect(result.value).toBe("item");
    expect(result.selectionStart).toBe(0);
  });
});
