import { afterEach, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { activeFindIndex, resolveDocumentFindSeed, wrapFindIndex } from "./documentFind";
import {
  applyDocumentFind,
  documentFindHighlightKey,
  DocumentFindHighlight,
} from "./documentFindHighlight";

let editor: Editor | null = null;

afterEach(() => {
  editor?.destroy();
  editor = null;
});

describe("document find index", () => {
  const ranges = [
    { from: 2, to: 6 },
    { from: 10, to: 14 },
  ];

  it("chooses the match that contains the caret, then the next one", () => {
    expect(activeFindIndex(ranges, 4)).toBe(0);
    expect(activeFindIndex(ranges, 8)).toBe(1);
    expect(activeFindIndex(ranges, 20)).toBe(0);
    expect(activeFindIndex([], 4)).toBe(0);
  });

  it("wraps next and previous", () => {
    expect(wrapFindIndex(1, 2, 1)).toBe(0);
    expect(wrapFindIndex(0, 2, -1)).toBe(1);
  });

  it("uses the workspace search word when a count click supplies one", () => {
    editor = new Editor({
      extensions: [StarterKit],
      content: "<p>Luke helped Luke leave.</p>",
    });
    editor.commands.setTextSelection({ from: 1, to: 5 });
    expect(resolveDocumentFindSeed("burnout", editor)).toBe("burnout");
    expect(resolveDocumentFindSeed("  ", editor)).toBe("Luke");
  });
});

describe("document find highlights", () => {
  it("marks every match and moves the active one", () => {
    editor = new Editor({
      extensions: [StarterKit, DocumentFindHighlight],
      content: "<p>Luke helped Luke leave.</p>",
    });

    const first = applyDocumentFind(editor.view, "Luke", 0);
    expect(first.ranges).toHaveLength(2);
    expect(first.activeIndex).toBe(0);

    const second = applyDocumentFind(editor.view, "luke", 1);
    expect(second.activeIndex).toBe(1);
    expect(second.ranges).toHaveLength(2);
    expect(documentFindHighlightKey.getState(editor.state)?.query).toBe("luke");
  });
});
